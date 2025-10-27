import { SiteSettingsForm } from "@/components/admin/SiteSettingsForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSiteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const site = await getSiteConfig();

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">站点设置</h1>
        <p className="text-muted-foreground">管理站点的基础信息和站点级默认配置。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基础信息</CardTitle>
          <CardDescription>更新站点标题、描述以及默认分享图像，配置将应用于整站。</CardDescription>
        </CardHeader>
        <CardContent>
          <SiteSettingsForm
            initialValues={{
              siteTitle: site.siteName,
              siteDescription: site.siteDescription,
              defaultOgImage: site.defaultOgImageSetting ?? "",
            }}
          />
        </CardContent>
      </Card>
    </section>
  );
}
