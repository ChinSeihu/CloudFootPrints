import { PRESET_COVERS } from "@/lib/covers";
import { PERSONAS, personaRefIndex, type PersonaV2 } from "@/lib/personas";

export type DemoUser = {
  username: string;
  signature: string;
  hometown: string;
  status: string;
  coverUrl: string;
  avatarUrl: string;
};

const cover = (i: number) => PRESET_COVERS[i % PRESET_COVERS.length].url;

function refAvatar(persona: PersonaV2): string {
  return `/avatars/persona-v2/${String(personaRefIndex(persona)).padStart(2, "0")}.png`;
}

function profileSignature(persona: PersonaV2): string {
  return `${persona.archetype} / ${persona.occupation}`;
}

export const DEMO_USERS: DemoUser[] = PERSONAS.map((persona, index) => ({
  username: persona.username,
  signature: profileSignature(persona),
  hometown: persona.homeArea,
  status: persona.dynamicContext.currentGoal,
  coverUrl: cover(index),
  avatarUrl: refAvatar(persona),
}));
