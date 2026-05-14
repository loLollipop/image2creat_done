import { ComingSoon } from "@/components/coming-soon";

export default function AdminGenerationsPage() {
  return (
    <ComingSoon
      kicker="Generations"
      title="生图记录"
      description="所有用户的生图调用审计：提示词 / 上游账号 / 状态 / 错误。"
      phase="P5"
      features={[
        "时间 / 用户 / 状态 / 模型 / 上游账号 五维筛选",
        "lightbox 查看生成结果与参考图",
        "失败原因聚合 + 一键重发",
      ]}
    />
  );
}
