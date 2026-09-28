import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Disclaimer } from "@/components/PredictionUI";
import { UserSubmittedLab } from "@/components/dwm/UserSubmittedLab";
import { useDwmData } from "@/components/dwm/useDwmData";
import {
  AspectsTab, CategoriesTab, ClustersTab, DatasetBadge, EmptyState, FinalInference, RulesTab,
  SyntheticBanner, TrendsTab, ValidationTab, WarehouseTab,
} from "@/components/dwm/HistoricalViews";
import { analyse } from "@/lib/dwm/historical";

export const Route = createFileRoute("/dwm")({
  component: DwmPage,
  head: () => ({
    meta: [
      { title: "Five-Year Indian Headlines Analysis — FNDVS DWM" },
      { name: "description", content: "ETL, star schema, OLAP, K-Means, Apriori and trend analysis over five years of Times of India headlines, with one final inference." },
      { property: "og:title", content: "Indian Headlines Risk-Signal Trends — FNDVS DWM" },
      { property: "og:description", content: "A data-warehousing and mining analysis of five years of Indian news headlines." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Mode = "historical" | "user" | "combined";

function DwmPage() {
  const { agg, source, loading } = useDwmData();
  const [mode, setMode] = useState<Mode>("historical");
  const a = useMemo(() => (agg ? analyse(agg) : null), [agg]);
  const showHist = mode !== "user";

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <PageHeader
          eyebrow="DWM Analytics"
          title="Indian headlines: five-year analysis"
          description="What the rule-based scorer finds when run over every Indian headline in a five-year window, summarised as one inference."
          action={<Button asChild variant="outline"><Link to="/dwm/import">Data import</Link></Button>}
        />

        <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Data source:</span>
          {([["historical", "Historical dataset"], ["user", "User-submitted"], ["combined", "Combined"]] as const).map(([m, l]) => (
            <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>{l}</Button>
          ))}
        </div>

        {showHist && (
          <div className="mt-6 grid gap-6">
            {loading ? (
              <div className="grid gap-4"><Skeleton className="h-64 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-80 w-full" /></div>
            ) : !agg || !a ? (
              <EmptyState note="No dataset loaded. Load the bundled results, upload the Times of India headlines CSV, or try synthetic demo data on the import page." />
            ) : (
              <>
                {agg.meta.isSynthetic && <SyntheticBanner />}
                <FinalInference agg={agg} a={a} />
                <DatasetBadge agg={agg} source={source} />
                <Tabs defaultValue="trends">
                  <div className="overflow-x-auto">
                    <TabsList className="w-max">
                      <TabsTrigger value="trends">Trends</TabsTrigger>
                      <TabsTrigger value="categories">Categories</TabsTrigger>
                      <TabsTrigger value="aspects">Credibility aspects</TabsTrigger>
                      <TabsTrigger value="clusters">Clusters</TabsTrigger>
                      <TabsTrigger value="rules">Association rules</TabsTrigger>
                      <TabsTrigger value="validation">Validation</TabsTrigger>
                      <TabsTrigger value="warehouse">Warehouse (star schema)</TabsTrigger>
                      {mode === "combined" && <TabsTrigger value="user">User-submitted</TabsTrigger>}
                    </TabsList>
                  </div>
                  <TabsContent value="trends" className="mt-4"><TrendsTab agg={agg} a={a} /></TabsContent>
                  <TabsContent value="categories" className="mt-4"><CategoriesTab a={a} /></TabsContent>
                  <TabsContent value="aspects" className="mt-4"><AspectsTab a={a} /></TabsContent>
                  <TabsContent value="clusters" className="mt-4"><ClustersTab agg={agg} /></TabsContent>
                  <TabsContent value="rules" className="mt-4"><RulesTab agg={agg} a={a} /></TabsContent>
                  <TabsContent value="validation" className="mt-4"><ValidationTab agg={agg} /></TabsContent>
                  <TabsContent value="warehouse" className="mt-4"><WarehouseTab agg={agg} /></TabsContent>
                  {mode === "combined" && <TabsContent value="user" className="mt-4"><UserSubmittedLab /></TabsContent>}
                </Tabs>
              </>
            )}
          </div>
        )}

        {mode === "user" && <div className="mt-6"><UserSubmittedLab /></div>}

        <div className="mt-10"><Disclaimer /></div>
      </div>
    </AppShell>
  );
}
