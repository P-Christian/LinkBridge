// src/modules/client/dashboard/components/UpcomingInterviewsCard.tsx
"use client";

import React, { useCallback, useMemo } from "react";
import { UpcomingInterviewItem } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, ArrowRight, Video, Clock, ChevronRight, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

interface UpcomingInterviewsCardProps {
  interviews: UpcomingInterviewItem[];
}

export default function UpcomingInterviewsCard({ interviews }: UpcomingInterviewsCardProps) {
  const router = useRouter();

  const handleNavigateSchedule = useCallback(() => {
    router.push("/linkbridge/client/interviews");
  }, [router]);

  const handleNavigateInterview = useCallback((interviewId: number) => {
    router.push(`/linkbridge/client/interviews?interviewId=${interviewId}`);
  }, [router]);

  const getInitials = (name: string) => {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (name[0] || "C").toUpperCase();
  };

  // Group interviews chronologically by distinct calendar date
  const groupedSections = useMemo(() => {
    const dateMap = new Map<
      string,
      { label: string; category: "today" | "tomorrow" | "future"; items: UpcomingInterviewItem[] }
    >();

    interviews.forEach((item) => {
      const key = item.dateKey || item.scheduledAt.split("T")[0] || item.scheduledAt.split(" ")[0] || "upcoming";
      const cat: "today" | "tomorrow" | "future" =
        item.displayDateGroup === "Today"
          ? "today"
          : item.displayDateGroup === "Tomorrow"
          ? "tomorrow"
          : "future";
      const label = item.dateLabel || item.displayDateGroup || key;

      if (!dateMap.has(key)) {
        dateMap.set(key, { label, category: cat, items: [] });
      }
      dateMap.get(key)!.items.push(item);
    });

    const groups: {
      key: string;
      label: string;
      category: "today" | "tomorrow" | "future";
      items: UpcomingInterviewItem[];
    }[] = [];

    dateMap.forEach((val, key) => {
      groups.push({
        key,
        label: val.label,
        category: val.category,
        items: val.items,
      });
    });

    return groups;
  }, [interviews]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      <Card className="bg-card/80 backdrop-blur-md border border-border/70 shadow-panel hover:shadow-panel-hover hover:border-primary/30 transition-[box-shadow,border-color] duration-200 rounded-2xl overflow-hidden flex flex-col justify-between h-full py-0">
        <div>
          <CardHeader className="p-4 md:p-5 md:pb-3 flex flex-row items-center justify-between border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/15 to-sky-500/20 text-primary ring-1 ring-primary/15 flex items-center justify-center">
                <Calendar className="h-4 w-4" />
              </div>
              <CardTitle className="text-base font-bold text-foreground">Upcoming Interviews</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNavigateSchedule}
              className="text-sm md:text-xs font-semibold text-primary hover:text-primary/90 h-8 max-md:min-h-10 px-2.5 flex items-center gap-1 group"
            >
              View Schedule
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </CardHeader>

          <CardContent className="p-4 md:p-5 space-y-5">
            {interviews.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm md:text-xs space-y-3">
                <Calendar className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <div className="space-y-1">
                  <p className="font-semibold text-foreground text-sm">No upcoming interviews</p>
                  <p className="text-xs md:text-[11px] text-muted-foreground">Your next scheduled interview will appear here.</p>
                </div>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNavigateSchedule}
                    className="text-sm md:text-xs font-semibold max-md:min-h-10"
                  >
                    View Interview Schedule
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {groupedSections.map((section) => (
                  <div key={section.key} className="space-y-2.5">
                    {/* Section Date Header */}
                    <div className="flex items-center justify-between">
                      {section.category === "today" ? (
                        <span className="text-xs md:text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                          {section.label}
                        </span>
                      ) : section.category === "tomorrow" ? (
                        <span className="text-xs md:text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          {section.label}
                        </span>
                      ) : (
                        <span className="text-xs md:text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                          {section.label}
                        </span>
                      )}
                      <span className="text-xs md:text-[10px] text-muted-foreground font-semibold">
                        {section.items.length} session{section.items.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {/* Interview items under this date */}
                    <div className="space-y-2">
                      {section.items.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleNavigateInterview(item.id)}
                          className="p-3 rounded-xl border border-border/80 bg-muted/20 hover:bg-muted/50 hover:border-primary/40 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 ${
                                section.category === "today"
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground font-semibold"
                              }`}
                            >
                              <Clock className="h-3 w-3" />
                              {item.displayTime}
                            </div>

                            <Avatar className="h-7 w-7 border border-border/80 shrink-0">
                              {item.candidateAvatar && (
                                <AvatarImage src={item.candidateAvatar} alt={item.candidateName} />
                              )}
                              <AvatarFallback className="bg-muted text-xs md:text-[10px] font-bold">
                                {getInitials(item.candidateName)}
                              </AvatarFallback>
                            </Avatar>

                            <div className="min-w-0">
                              <p className="text-sm md:text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                {item.candidateName}
                              </p>
                              <p className="text-xs md:text-[11px] text-muted-foreground truncate">{item.jobTitle}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant="outline"
                              className="text-xs md:text-[10px] font-medium border-border/70 hidden sm:inline-flex items-center gap-1 py-0.5"
                            >
                              {item.format === "ONLINE" ? (
                                <>
                                  <Video className="h-2.5 w-2.5 text-primary" /> Online
                                </>
                              ) : (
                                <>
                                  <MapPin className="h-2.5 w-2.5 text-muted-foreground" /> In-Person
                                </>
                              )}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 max-md:min-h-10 text-xs md:text-[11px] font-semibold text-primary px-2 opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity"
                            >
                              View
                              <ChevronRight className="h-3 w-3 ml-0.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </div>
 
      </Card>
    </motion.div>
  );
}
