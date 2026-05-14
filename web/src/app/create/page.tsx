import { AuthGuard } from "@/components/auth-guard";
import { ComingSoon } from "@/components/coming-soon";

export default function CreatePage() {
  return (
    <AuthGuard>
      <ComingSoon
        kicker="Create"
        title="图片生成"
        description="将原有 public/index.html 的生成主流程迁移到新的 composer + history 组件。"
        phase="P1"
        features={[
          "composer：模型 / 尺寸 / 质量 / 背景 / 格式 / 参考图",
          "history：流式生成状态 + 多图编辑器",
          "节流提示 + 失败退款 + 公开到广场开关",
        ]}
      />
    </AuthGuard>
  );
}
