import titles from "../data/game-tag-texts.json";
import registry from "../data/lineup-sharing-tags.json";
import type { TagOption } from "./components/TagSelector";
export const gameTagOptions: TagOption[] = [
  ...registry.tags.filter((tag) => !tag.system).map((tag) => ({ ...tag, group: "队列标签" })),
  ...titles.titles.map((title) => ({
    ...title,
    group: "官方游戏称号",
    sourceNote: "localizationSource" in title ? "中文参考游戏本地化镜像" : undefined,
  })),
];
