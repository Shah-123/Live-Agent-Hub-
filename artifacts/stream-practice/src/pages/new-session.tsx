import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { useCreateSession } from "@workspace/api-client-react";
import { AGENTS } from "@/lib/agents";
import { Play, Sparkles, Flame, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  difficulty: z.enum(["chill", "medium", "viral"]),
  durationMinutes: z.number().min(1).max(120),
  activeAgents: z.array(z.string()).min(1, "Select at least one agent"),
});

const DIFFICULTY_OPTIONS = [
  {
    value: "chill" as const,
    label: "Chill",
    desc: "Supportive, easy-going",
    icon: Sparkles,
    activeColor: "border-green-500 bg-green-500/10",
    iconColor: "text-green-500",
  },
  {
    value: "medium" as const,
    label: "Medium",
    desc: "Realistic, balanced",
    icon: Flame,
    activeColor: "border-violet-500 bg-violet-500/10",
    iconColor: "text-violet-500",
  },
  {
    value: "viral" as const,
    label: "Viral",
    desc: "Fast, demanding, chaotic",
    icon: Zap,
    activeColor: "border-red-500 bg-red-500/10",
    iconColor: "text-red-500",
  },
];

export default function NewSession() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createSession = useCreateSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "Just Chatting Practice",
      difficulty: "medium",
      durationMinutes: 15,
      activeAgents: Object.keys(AGENTS),
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createSession.mutate(
      { data },
      {
        onSuccess: (session) => {
          toast({ title: "Session Created", description: "Get ready to go live!" });
          setLocation(`/session/${session.id}`);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to create session.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4 flex justify-center items-start">
      <div className="max-w-3xl w-full">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-black tracking-tight text-white uppercase italic drop-shadow-md">
            Configure <span className="text-primary">Lobby</span>
          </h1>
          <p className="text-muted-foreground mt-2">Setup your environment before going live.</p>
        </div>

        <Card className="bg-card border-border shadow-xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="p-8 space-y-8">

                {/* Title */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg font-bold text-white">Stream Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. My First Live Rehearsal"
                          className="text-lg py-6 bg-background border-muted"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Duration */}
                <FormField
                  control={form.control}
                  name="durationMinutes"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <div className="flex justify-between items-center">
                        <FormLabel className="text-lg font-bold text-white">Target Duration</FormLabel>
                        <span className="text-primary font-mono font-bold text-lg">{field.value} minutes</span>
                      </div>
                      <FormControl>
                        <Slider
                          min={5}
                          max={60}
                          step={5}
                          value={[field.value]}
                          onValueChange={(vals) => field.onChange(vals[0])}
                          className="py-4"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Difficulty — plain button grid, no peer hacks */}
                <FormField
                  control={form.control}
                  name="difficulty"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <FormLabel className="text-lg font-bold text-white">Chat Vibe</FormLabel>
                      <div className="grid grid-cols-3 gap-4">
                        {DIFFICULTY_OPTIONS.map((opt) => {
                          const Icon = opt.icon;
                          const isSelected = field.value === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => field.onChange(opt.value)}
                              className={`flex flex-col items-center justify-center rounded-lg border-2 p-5 transition-all cursor-pointer focus:outline-none ${
                                isSelected
                                  ? opt.activeColor
                                  : "border-muted bg-background hover:bg-muted/50"
                              }`}
                            >
                              <Icon className={`mb-2 h-7 w-7 ${isSelected ? opt.iconColor : "text-muted-foreground"}`} />
                              <span className={`font-bold text-sm uppercase tracking-wide ${isSelected ? "text-white" : "text-muted-foreground"}`}>
                                {opt.label}
                              </span>
                              <span className="text-xs text-muted-foreground mt-1 text-center">{opt.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Agents */}
                <FormField
                  control={form.control}
                  name="activeAgents"
                  render={() => (
                    <FormItem className="space-y-4">
                      <div className="mb-2">
                        <FormLabel className="text-lg font-bold text-white">Active Chatters</FormLabel>
                        <p className="text-sm text-muted-foreground mt-1">
                          Choose which personality types appear in your chat.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.values(AGENTS).map((agent) => (
                          <FormField
                            key={agent.id}
                            control={form.control}
                            name="activeAgents"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-muted p-3 hover:bg-muted/50 cursor-pointer">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(agent.id)}
                                    onCheckedChange={(checked) => {
                                      checked
                                        ? field.onChange([...field.value, agent.id])
                                        : field.onChange(field.value?.filter((v) => v !== agent.id));
                                    }}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="cursor-pointer font-medium flex items-center gap-1">
                                    <span className="text-lg">{agent.emoji}</span>
                                    <span style={{ color: agent.color }}>{agent.name}</span>
                                  </FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>

              <CardFooter className="p-8 pt-0 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setLocation("/")}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  className="font-bold uppercase tracking-wider bg-primary hover:bg-primary/90 text-white shadow-[0_0_15px_rgba(124,58,237,0.5)]"
                  disabled={createSession.isPending}
                >
                  {createSession.isPending ? "Preparing..." : "Go Live"}
                  <Play className="ml-2 h-5 w-5 fill-current" />
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}
