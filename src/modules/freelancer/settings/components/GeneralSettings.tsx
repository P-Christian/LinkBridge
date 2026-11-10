"use client";

import React from "react";
import { useTheme } from "next-themes";
import { useThemeSettings } from "@/components/theme/useThemeSettings";
import { useThemeCurtain } from "@/components/theme/useThemeCurtain";
import { ACCENTS, DEFAULT_THEME_SETTINGS, clamp } from "@/components/theme/theme-settings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Check, Monitor, Moon, Sun, RefreshCw, Palette } from "lucide-react";

function AccentSwatch({ hsl }: { hsl: string }) {
  return (
    <span
      className="inline-flex h-4 w-4 rounded-full border"
      style={{ backgroundColor: `hsl(${hsl})` }}
      aria-hidden="true"
    />
  );
}

export default function GeneralSettings() {
  const { theme } = useTheme();
  const { switchTheme } = useThemeCurtain();
  const { settings: themeSettings, updateSettings: updateThemeSettings, resetSettings: resetThemeSettings } = useThemeSettings();

  const previewTripletByAccent = React.useMemo(() => {
    return new Map(ACCENTS.map((a) => [a.key, `${a.hue} ${a.sat}% 48%`]));
  }, []);

  const radiusPx = Math.round(themeSettings.radiusRem * 16);

  return (
    <div className="space-y-6">
      {/* Appearance Section (VOS Style Settings) */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="p-2 bg-pink-500/10 dark:bg-pink-500/20 text-pink-500 rounded-xl">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Appearance & Themes</CardTitle>
            <CardDescription>Select visual styling options, accent primary highlights, and border corner radiuses.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-2">
            <Label>Theme mode</Label>
            <ToggleGroup
              type="single"
              value={theme ?? "system"}
              onValueChange={(v) => {
                if (v) switchTheme(v as "light" | "dark" | "system");
              }}
              className="justify-start"
            >
              <ToggleGroupItem value="light" className="gap-2 max-md:min-h-11">
                <Sun className="h-4 w-4" /> Light
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" className="gap-2 max-md:min-h-11">
                <Moon className="h-4 w-4" /> Dark
              </ToggleGroupItem>
              <ToggleGroupItem value="system" className="gap-2 max-md:min-h-11">
                <Monitor className="h-4 w-4" /> System
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <Separator />

          {/* Accent Selection */}
          <div className="grid gap-3">
            <Label>Accent Color (Primary Highlights)</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ACCENTS.map((a) => {
                const triplet = previewTripletByAccent.get(a.key) ?? "224 76% 48%";
                const active = themeSettings.accent === a.key;

                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => updateThemeSettings({ accent: a.key })}
                    className={cn(
                      "flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-left text-sm transition max-md:min-h-11",
                      "hover:bg-accent/60",
                      active && "ring-2 ring-ring"
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      <AccentSwatch hsl={triplet} />
                      {a.name}
                    </span>
                    {active ? <Check className="h-4 w-4 text-primary" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Radius Slider */}
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-4">
              <Label>Border Corner Radius</Label>
              <span className="text-sm md:text-xs text-muted-foreground">{radiusPx}px</span>
            </div>
            <Slider
              value={[themeSettings.radiusRem]}
              min={0.4}
              max={1.25}
              step={0.05}
              onValueChange={(v) => {
                const next = clamp(v?.[0] ?? DEFAULT_THEME_SETTINGS.radiusRem, 0.4, 1.25);
                updateThemeSettings({ radiusRem: next });
              }}
            />
          </div>

          <Separator />

          {/* Density selection */}
          <div className="grid gap-2">
            <Label>UI Density</Label>
            <ToggleGroup
              type="single"
              value={themeSettings.density}
              onValueChange={(v) => {
                if (v) updateThemeSettings({ density: v as "comfortable" | "compact" });
              }}
              className="justify-start"
            >
              <ToggleGroupItem value="comfortable" className="max-md:min-h-11">Comfortable</ToggleGroupItem>
              <ToggleGroupItem value="compact" className="max-md:min-h-11">Compact</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardContent>
      </Card>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-4 border-t max-md:flex-wrap max-md:gap-2">
        <Button
          variant="outline"
          onClick={() => {
            resetThemeSettings();
          }}
          className="rounded-xl max-md:min-h-11"
        >
          <RefreshCw className="h-4 w-4 mr-2" /> Reset theme defaults
        </Button>
      </div>
    </div>
  );
}
