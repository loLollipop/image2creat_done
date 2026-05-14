import { AuthGuard } from "@/components/auth-guard";
import { ComingSoon } from "@/components/coming-soon";

export default function LibraryPage() {
  return (
    <AuthGuard>
      <ComingSoon
        kicker="Library"
        title="提示词库"
        description="迁移 public/prompts.json + 提示词搜索与标签过滤。"
        phase="P3"
        features={["搜索 + 标签筛选", "卡片预览与一键带入 composer", "中英双语描述"]}
      />
    </AuthGuard>
  );
}
