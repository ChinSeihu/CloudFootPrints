import "./loadEnv";

type CloudinaryResource = {
  public_id: string;
  secure_url?: string;
  created_at: string;
  bytes?: number;
};

type ResourcePage = {
  resources?: CloudinaryResource[];
  next_cursor?: string;
};

type DeleteResponse = {
  deleted?: Record<string, string>;
  partial?: boolean;
  error?: { message?: string };
};

let disconnectDatabase: (() => Promise<void>) | undefined;

function argument(name: string): string | undefined {
  return process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
}

function positiveNumber(name: string, fallback: number): number {
  const raw = argument(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`--${name} must be a non-negative number`);
  }
  return value;
}

function credentials() {
  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME ??
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Missing Cloudinary Admin credentials: CLOUDINARY_CLOUD_NAME (or NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME), CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are required.",
    );
  }

  return {
    cloudName,
    authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`,
  };
}

export function cloudinaryPublicId(
  value: string,
  expectedCloudName: string,
): string | null {
  try {
    const url = new URL(value);
    if (url.hostname !== "res.cloudinary.com") return null;

    const parts = url.pathname.split("/").filter(Boolean);
    if (
      parts[0] !== expectedCloudName ||
      parts[1] !== "image" ||
      parts[2] !== "upload"
    ) {
      return null;
    }

    const versionIndex = parts.findIndex(
      (part, index) => index >= 3 && /^v\d+$/.test(part),
    );
    let assetParts =
      versionIndex >= 0 ? parts.slice(versionIndex + 1) : parts.slice(3);
    if (versionIndex < 0) {
      while (
        assetParts.length > 1 &&
        (assetParts[0].includes(",") ||
          /^(?:a|ar|b|bo|c|co|d|dl|dn|dpr|du|e|eo|f|fl|fn|fps|g|h|ki|l|o|p|pg|q|r|so|sp|t|u|vc|vs|w|x|y|z)_/.test(
            assetParts[0],
          ))
      ) {
        assetParts = assetParts.slice(1);
      }
    }
    if (assetParts.length === 0) return null;

    const encodedId = assetParts.join("/");
    const decodedId = decodeURIComponent(encodedId);
    return decodedId.replace(/\.[^./]+$/, "") || null;
  } catch {
    return null;
  }
}

async function collectReferencedPublicIds(
  cloudName: string,
): Promise<Set<string>> {
  const { prisma } = await import("../src/lib/db");
  disconnectDatabase = () => prisma.$disconnect();
  const [events, posts, checkins, users, hotPepperPois] = await Promise.all([
    prisma.event.findMany({ select: { imageUrl: true } }),
    prisma.post.findMany({ select: { imageUrl: true, imageUrls: true } }),
    prisma.checkIn.findMany({ select: { photoUrl: true, photoUrls: true } }),
    prisma.user.findMany({ select: { avatarUrl: true, coverUrl: true } }),
    prisma.hotPepperPoi.findMany({ select: { photo: true } }),
  ]);

  const urls = [
    ...events.flatMap((row) => [row.imageUrl]),
    ...posts.flatMap((row) => [row.imageUrl, ...row.imageUrls]),
    ...checkins.flatMap((row) => [row.photoUrl, ...row.photoUrls]),
    ...users.flatMap((row) => [row.avatarUrl, row.coverUrl]),
    ...hotPepperPois.flatMap((row) => [row.photo]),
  ];

  return new Set(
    urls
      .filter((url): url is string => Boolean(url))
      .map((url) => cloudinaryPublicId(url, cloudName))
      .filter((publicId): publicId is string => Boolean(publicId)),
  );
}

async function listResources(
  cloudName: string,
  authorization: string,
  prefix: string,
): Promise<CloudinaryResource[]> {
  const resources: CloudinaryResource[] = [];
  let nextCursor: string | undefined;

  do {
    const url = new URL(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload`,
    );
    url.searchParams.set("max_results", "500");
    url.searchParams.set("prefix", prefix);
    if (nextCursor) url.searchParams.set("next_cursor", nextCursor);

    const response = await fetch(url, {
      headers: { Authorization: authorization },
    });
    if (!response.ok) {
      throw new Error(
        `Cloudinary resource listing failed (${response.status}): ${await response.text()}`,
      );
    }

    const page = (await response.json()) as ResourcePage;
    resources.push(...(page.resources ?? []));
    nextCursor = page.next_cursor;
  } while (nextCursor);

  return resources;
}

async function deleteResources(
  cloudName: string,
  authorization: string,
  publicIds: string[],
): Promise<number> {
  const body = new URLSearchParams();
  for (const publicId of publicIds) {
    body.append("public_ids[]", publicId);
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload`,
    {
      method: "DELETE",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
  const result = (await response.json()) as DeleteResponse;
  if (!response.ok || result.error) {
    throw new Error(
      `Cloudinary deletion failed (${response.status}): ${result.error?.message ?? JSON.stringify(result)}`,
    );
  }

  return Object.values(result.deleted ?? {}).filter(
    (status) => status === "deleted",
  ).length;
}

function runSelfTest() {
  const cloudName = "demo";
  const cases: Array<[string, string | null]> = [
    [
      "https://res.cloudinary.com/demo/image/upload/v123/cloudfootprints/a.png",
      "cloudfootprints/a",
    ],
    [
      "https://res.cloudinary.com/demo/image/upload/q_auto,f_auto/v456/cloudfootprints/a.b.jpg",
      "cloudfootprints/a.b",
    ],
    [
      "https://res.cloudinary.com/demo/image/upload/q_auto,f_auto/cloudfootprints/no-version.webp",
      "cloudfootprints/no-version",
    ],
    ["https://example.com/image.png", null],
    [
      "https://res.cloudinary.com/other/image/upload/v1/cloudfootprints/a.png",
      null,
    ],
  ];

  for (const [url, expected] of cases) {
    const actual = cloudinaryPublicId(url, cloudName);
    if (actual !== expected) {
      throw new Error(
        `Self-test failed for ${url}: expected ${expected}, received ${actual}`,
      );
    }
  }
  console.log("Cloudinary URL parser self-test passed.");
}

async function main() {
  if (process.argv.includes("--self-test")) {
    runSelfTest();
    return;
  }

  const execute = process.argv.includes("--execute");
  const minAgeDays = positiveNumber("min-age-days", 3);
  const maxDelete = Math.floor(positiveNumber("max-delete", 200));
  const prefix =
    argument("prefix") ??
    process.env.CLOUDINARY_CLEANUP_PREFIX ??
    "cloudfootprints/";

  if (!prefix.trim() || prefix === "/") {
    throw new Error("Cleanup prefix must be a non-empty asset folder prefix.");
  }
  if (execute && maxDelete === 0) {
    throw new Error("--max-delete must be greater than zero with --execute");
  }

  const { cloudName, authorization } = credentials();
  const [referenced, resources] = await Promise.all([
    collectReferencedPublicIds(cloudName),
    listResources(cloudName, authorization, prefix),
  ]);
  const cutoff = Date.now() - minAgeDays * 24 * 60 * 60 * 1000;
  const candidates = resources
    .filter((resource) => {
      const createdAt = Date.parse(resource.created_at);
      return (
        Number.isFinite(createdAt) &&
        createdAt <= cutoff &&
        !referenced.has(resource.public_id)
      );
    })
    .sort(
      (left, right) =>
        Date.parse(left.created_at) - Date.parse(right.created_at),
    );

  console.log(`Cloud: ${cloudName}`);
  console.log(`Prefix: ${prefix}`);
  console.log(`Minimum age: ${minAgeDays} days`);
  console.log(`Assets scanned: ${resources.length}`);
  console.log(`Referenced Cloudinary assets: ${referenced.size}`);
  console.log(`Unreferenced cleanup candidates: ${candidates.length}`);

  for (const resource of candidates.slice(0, 50)) {
    const size = resource.bytes
      ? ` (${(resource.bytes / 1024 / 1024).toFixed(2)} MiB)`
      : "";
    console.log(`  ${resource.created_at}  ${resource.public_id}${size}`);
  }
  if (candidates.length > 50) {
    console.log(`  ... and ${candidates.length - 50} more`);
  }

  if (!execute || candidates.length === 0) {
    console.log(
      candidates.length === 0
        ? "Nothing to clean."
        : "Dry run only. Add --execute to delete these assets.",
    );
    return;
  }

  if (referenced.size === 0) {
    throw new Error(
      "Refusing destructive cleanup because no Cloudinary references were found in the database.",
    );
  }

  const limited = candidates.slice(0, maxDelete);
  let deleted = 0;
  let skippedAfterRecheck = 0;

  for (let index = 0; index < limited.length; index += 100) {
    const batch = limited.slice(index, index + 100);
    const latestReferences = await collectReferencedPublicIds(cloudName);
    const safePublicIds = batch
      .map((resource) => resource.public_id)
      .filter((publicId) => !latestReferences.has(publicId));
    skippedAfterRecheck += batch.length - safePublicIds.length;

    if (safePublicIds.length > 0) {
      deleted += await deleteResources(
        cloudName,
        authorization,
        safePublicIds,
      );
    }
  }

  console.log(`Deleted assets: ${deleted}`);
  console.log(`Skipped after reference recheck: ${skippedAfterRecheck}`);
  if (candidates.length > limited.length) {
    console.log(
      `Deletion cap reached; ${candidates.length - limited.length} candidates remain for the next run.`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase?.();
  });
