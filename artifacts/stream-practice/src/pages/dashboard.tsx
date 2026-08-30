import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Activity, Clock, MessageSquare, History } from "lucide-react";
import { format } from "date-fns";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import type { SessionsSummary, Session } from "@workspace/api-client-react/generated/api.schemas";

// Fallback hook since the generated one isn't fully exported in the stub
function useGetSessionsSummary() {
  return useQuery({
    queryKey: ["/api/sessions/stats/summary"],
    queryFn: () => customFetch<SessionsSummary>("/api/sessions/stats/summary"),
  });
}

function useListSessions() {
  return useQuery({
    queryKey: ["/api/sessions"],
    queryFn: () => customFetch<Session[]>("/api/sessions"),
  });
}

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetSessionsSummary();
  const { data: sessions, isLoading: loadingSessions } = useListSessions();

  return (
    <div className="min-h-screen bg-background p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white uppercase italic drop-shadow-md">
              StreamPractice <span className="text-primary">AI</span>
            </h1>
            <p className="text-muted-foreground mt-1">Your private training dojo for going live.</p>
          </div>
          <Link href="/session/new">
            <Button size="lg" className="font-bold uppercase tracking-wider text-md bg-primary hover:bg-primary/90 text-white shadow-[0_0_15px_rgba(124,58,237,0.5)] transition-all">
              <Play className="mr-2 h-5 w-5 fill-current" />
              Start New Session
            </Button>
          </Link>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Sessions"
            value={loadingSummary ? "-" : summary?.totalSessions ?? 0}
            icon={<History className="h-5 w-5 text-blue-400" />}
          />
          <StatCard
            title="Avg Energy Score"
            value={loadingSummary ? "-" : `${Math.round(summary?.avgEnergyScore ?? 0)}%`}
            icon={<Activity className="h-5 w-5 text-orange-400" />}
          />
          <StatCard
            title="Talk Time"
            value={loadingSummary ? "-" : `${summary?.totalTalkTimeMinutes ?? 0}m`}
            icon={<Clock className="h-5 w-5 text-green-400" />}
          />
          <StatCard
            title="Total Messages"
            value={loadingSummary ? "-" : summary?.totalMessages ?? 0}
            icon={<MessageSquare className="h-5 w-5 text-purple-400" />}
          />
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <History className="h-6 w-6 text-primary" />
              Recent Rehearsals
            </h2>
          </div>

          {loadingSessions ? (
            <div className="text-muted-foreground">Loading history...</div>
          ) : !sessions || sessions.length === 0 ? (
            <Card className="bg-card/50 border-dashed border-2 border-muted text-center py-12">
              <CardContent className="pt-6">
                <div className="bg-muted/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Play className="h-8 w-8 text-muted-foreground ml-1" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No sessions yet</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Hit the floor. Start your first rehearsal session to simulate a live audience and get actionable feedback.
                </p>
                <Link href="/session/new">
                  <Button variant="outline" className="font-bold uppercase tracking-wide">
                    Start Your First Session
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map((session) => (
                <Card key={session.id} className="bg-card border-border hover:border-primary/50 transition-colors group cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start mb-2">
                      <div className="px-2 py-1 rounded text-xs font-bold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30">
                        {session.difficulty}
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {session.durationMinutes}m
                      </span>
                    </div>
                    <CardTitle className="text-lg text-white group-hover:text-primary transition-colors">
                      {session.title}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {format(new Date(session.createdAt), "MMM d, yyyy • h:mm a")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center text-sm mt-4">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MessageSquare className="h-4 w-4" />
                        <span>{session.totalMessages} msgs</span>
                      </div>
                      <Link href={`/session/${session.id}${session.status === 'ended' ? '/analytics' : ''}`}>
                        <Button size="sm" variant={session.status === 'ended' ? "secondary" : "default"} className="font-bold">
                          {session.status === 'ended' ? 'View Stats' : 'Resume'}
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-6 flex items-center gap-4">
        <div className="p-3 bg-muted/50 rounded-lg">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <h4 className="text-3xl font-black text-white tracking-tight">{value}</h4>
        </div>
      </CardContent>
    </Card>
  );
}
