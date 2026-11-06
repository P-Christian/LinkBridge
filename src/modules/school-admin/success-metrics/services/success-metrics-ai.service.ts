// src/modules/school-admin/success-metrics/services/success-metrics-ai.service.ts
import { callGeminiRaw } from '@/lib/gemini/geminiClient';
import {
  AiMetricsInsightRequest,
  AiMetricsInsightResponse,
} from '../types/success-metrics.types';

/**
 * Pure AI service: receives in-memory metrics summary and generates qualitative narrative.
 * STRICT ISOLATION GUARANTEE: Does NOT fetch or touch the database or Directus.
 */
export async function generateMetricsAiInsights(
  stats: AiMetricsInsightRequest
): Promise<AiMetricsInsightResponse> {
  const prompt = `
You are an expert Higher Education Career Placement Analyst and Accreditation Consultant.
Analyze the following student employment metrics for ${stats.schoolName || 'the Academic Institution'} and produce a professional, structured executive insight report.

Metrics Summary:
- Total Enrolled Students / Cohort Size: ${stats.totalStudents}
- Registered on LinkBridge Platform: ${stats.registeredStudents}
- Total Hired Graduates: ${stats.hiredCount}
- Overall Placement Rate: ${stats.placementRate}%
- Active Pipeline (Interviewing/Under Review): ${stats.activePipelineCount}
- Average Time to Placement: ${stats.avgTimeToHireDays} days
- Top Performing Course: ${stats.topCourse || 'N/A'}

Course Placement Breakdown:
${stats.courseStatsSummary
      .map(
        (c) =>
          `- ${c.courseName}: ${c.placementRate}% placement rate (${c.hiredCount} hired)`
      )
      .join('\n')}

Top Hiring Employers:
${stats.topCompaniesSummary
      .map((comp) => `- ${comp.companyName}: ${comp.hiredCount} graduates hired`)
      .join('\n')}

Please return ONLY a valid JSON object matching this exact schema:
{
  "executiveSummary": "2-3 concise sentences summarizing the overall placement health and key takeaway.",
  "keyStrengths": [
    "Strength point 1 highlighting high performing courses or strong metrics",
    "Strength point 2 highlighting pipeline or company adoption"
  ],
  "growthOpportunities": [
    "Area 1 where conversion or registration could improve",
    "Area 2 regarding specific lower-performing degrees or hiring velocity"
  ],
  "actionableRecommendations": [
    "Concrete recommendation 1 for School Administrators / Career Deans",
    "Concrete recommendation 2 for industry partnerships or student prep",
    "Concrete recommendation 3"
  ]
}

DO NOT include markdown code fences or backticks. Return only pure parseable JSON.
`.trim();

  const geminiResult = await callGeminiRaw(prompt, 15000);

  if (!geminiResult.text || geminiResult.finishReason === 'ERROR') {
    // Fallback heuristic response if AI is temporarily unavailable
    return {
      executiveSummary: `The cohort currently maintains a ${stats.placementRate}% placement rate with ${stats.hiredCount} graduates hired. ${stats.topCourse ? `${stats.topCourse} leads in graduate employment.` : ''}`,
      keyStrengths: [
        `Active pipeline of ${stats.activePipelineCount} candidate(s) currently progressing in interviews.`,
        `${stats.hiredCount} student(s) successfully placed into roles across industry partners.`,
      ],
      growthOpportunities: [
        `Bridge registration gap between ${stats.totalStudents} total students and ${stats.registeredStudents} platform-active students.`,
        `Accelerate average time to placement (${stats.avgTimeToHireDays} days) through targeted faculty referrals.`,
      ],
      actionableRecommendations: [
        'Organize dedicated employer interview days for courses with developing placement rates.',
        'Encourage faculty advisors to refer shortlisted graduates directly to active job postings.',
        'Conduct resume and mock interview workshops for students in the active application pipeline.',
      ],
      generatedAt: new Date().toISOString(),
    };
  }

  try {
    const cleanedText = geminiResult.text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedText);

    return {
      executiveSummary: String(parsed.executiveSummary || ''),
      keyStrengths: Array.isArray(parsed.keyStrengths) ? parsed.keyStrengths.map(String) : [],
      growthOpportunities: Array.isArray(parsed.growthOpportunities) ? parsed.growthOpportunities.map(String) : [],
      actionableRecommendations: Array.isArray(parsed.actionableRecommendations) ? parsed.actionableRecommendations.map(String) : [],
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      executiveSummary: geminiResult.text.slice(0, 300),
      keyStrengths: [`Strong engagement with ${stats.topCompaniesSummary.length} employer partner(s).`],
      growthOpportunities: ['Further optimize course placement rates.'],
      actionableRecommendations: ['Expand student registration drives and industry referral partnerships.'],
      generatedAt: new Date().toISOString(),
    };
  }
}
