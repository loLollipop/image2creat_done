import { AuthGuard } from "@/components/auth-guard";
import { ComingSoon } from "@/components/coming-soon";

export default function WorksPage() {
  return (
    <AuthGuard>
      <ComingSoon
        kicker="My Works"
        title="我的作品"
        description="迁移老版个人作品 modal，改为完整页面 + 网格 + 图片预览。"
        phase="P2"
        features={["分页 / 时间分组", "公开切换 + 删除", "再生成 / 编辑入口"]}
      />
    </AuthGuard>
  );
}
