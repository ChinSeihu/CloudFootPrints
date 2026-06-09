import { MapExplorer } from "@/components/Map/MapExplorer";

// 地图页（默认）：空间维度的主探索入口。
// 客户端组件承载 MapLibre；服务端页只做挂载。
export default function MapPage() {
  return <MapExplorer />;
}
