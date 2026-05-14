import { ComingSoon } from "@/components/coming-soon";

export default function SquarePage() {
  return (
    <ComingSoon
      kicker="Square"
      title="公开广场"
      description="展示用户允许公开的作品流。"
      phase="P3"
      features={["流式加载", "按时间 / 热度排序", "举报 / 收藏入口"]}
    />
  );
}
