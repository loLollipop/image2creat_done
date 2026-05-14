import { ComingSoon } from "@/components/coming-soon";

export default function AdminUpstreamPage() {
  return (
    <ComingSoon
      kicker="Upstream & Backup"
      title="上游与备份"
      description="合并：chatgpt2api 调用日志、上游运行参数、远程备份。"
      phase="P6"
      features={[
        "tab：调用日志 / 上游设置 / 备份",
        "调用日志：分页 + 按账号 / 模型 / 状态筛选 + 批量删除",
        "上游设置：常用项放顶层，敏感词 / AI 审核 / 日志级别等放高级折叠",
        "备份：列表 + 一键执行 + 测试连接 + 下载 + 详情",
      ]}
    />
  );
}
