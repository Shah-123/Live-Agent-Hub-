import { useParams } from "wouter";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Clock, MessageSquare, Zap, Target, ArrowLeft } from "lucide-react";
import type { SessionAnalytics, Session } from "@workspace/api-client-react/generated/api.schemas";
import { AGENTS, AgentId } from "@/lib/agents";

function useGetSessionAnalytics(id: number) {
  return useQuery({
    queryKey: [`/api/sessions/${id}/analytics`],
    queryFn: () => customFetch<SessionAnalytics>(`/api/sessions/${id}/analytics`),
    enabled: !!id,
  });
}

function useGetSession(id: number) {
  return useQuery({
    queryKey: [`/api/sessions/${id}`],
    queryFn: () => customFetch<Session>(`/api/sessions/${id}`),
    enabled: !!id,
  });
}

export default function Analytics() {
  const params = useParams();
  const sessionId = parseInt(params.id || "0", 10);

  const { data: analytics, isLoading: loadingAnalytics } = useGetSessionAnalytics(sessionId);
  const { data: session, isLoading: loadingSession } = useGetSession(sessionId);

  if (loadingAnalytics || loadingSession) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-white">Generating post-stream report...</div>;
  }

  if (!analytics || !session) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-white">Data not found.</div>;
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="min-h-screen bg-background p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-muted-foreground p-0 hover:bg-transparent hover:text-white">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              </Link>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase drop-shadow-md">
              Stream <span className="text-primary">Debrief</span>
            </h1>
            <p className="text-muted-foreground mt-1">Session: {session.title}</p>
          </div>
          
          <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-6">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Energy Score</p>
              <div className="text-4xl font-black text-primary drop-shadow-[0_0_10px_rgba(124,58,237,0.5)]">
                {Math.round(analytics.energyScore)}
              </div>
            </div>
            <div className="h-12 w-px bg-border"></div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Difficulty</p>
              <div className="text-xl font-bold text-white uppercase">
                {session.difficulty}
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-400" /> Talk Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {formatTime(analytics.totalTalkTimeSeconds)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Active speaking duration
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-400" /> Dead Air
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {analytics.totalSilenceGaps} gaps
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Longest gap: {analytics.longestSilenceSeconds}s
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-400" /> Chat Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {analytics.totalMessages} msgs
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round(analytics.chatResponseRate)} msgs / minute
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Audience Breakdown */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-xl text-white flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Audience Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.agentBreakdown.sort((a,b) => b.messageCount - a.messageCount).map(stat => {
                  const agent = AGENTS[stat.agentType as AgentId] || AGENTS.lurker;
                  const percentage = analytics.totalMessages > 0 ? (stat.messageCount / analytics.totalMessages) * 100 : 0;
                  
                  return (
                    <div key={stat.agentType} className="flex items-center gap-3">
                      <div className="w-8 text-center text-xl">{agent.emoji}</div>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-bold text-white">{agent.name}</span>
                          <span className="text-muted-foreground">{stat.messageCount} msgs</span>
                        </div>
                        <div className="h-2 w-full bg-background rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-1000" 
                            style={{ width: `${percentage}%`, backgroundColor: agent.color }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* AI Tips */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-xl text-white flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-400" />
                Coach's Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {analytics.tips.length > 0 ? (
                  analytics.tips.map((tip, i) => (
                    <li key={i} className="flex gap-3 bg-muted/20 p-4 rounded-lg border border-muted">
                      <div className="shrink-0 mt-0.5 w-2 h-2 rounded-full bg-primary" />
                      <p className="text-sm text-gray-300 leading-relaxed">{tip}</p>
                    </li>
                  ))
                ) : (
                  <li className="text-muted-foreground italic text-center p-8">
                    No notes for this session. You did great!
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center pt-8">
          <Link href="/">
            <Button size="lg" variant="outline" className="font-bold uppercase tracking-wider">
              Return to Dojo
            </Button>
          </Link>
        </div>

      </div>
    </div>
  );
}
