
import React from "react";
import { 
  BarChart2, 
  Users, 
  Lightbulb, 
  Clock,
  Bot
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import StatusBadge from "@/components/dashboard/StatusBadge";
import StatsCard from "@/components/dashboard/StatsCard";
import WorkflowStatus from "@/components/dashboard/WorkflowStatus";
import TweetCard from "@/components/dashboard/TweetCard";

const FirasGptPage: React.FC = () => {
  // Placeholder data
  const workflowSteps = [
    { name: "Topic Selection", status: "completed", time: "09:30 AM" },
    { name: "Content Generation", status: "completed", time: "10:15 AM" },
    { name: "Quality Review", status: "in-progress" },
    { name: "Posting to Twitter", status: "pending" },
  ];
  
  const recentTweets = [
    {
      content: "The future of AI is not just about automation, but about augmentation. Building systems that enhance human capabilities rather than replace them.",
      date: "Yesterday, 2:30 PM",
      metrics: { likes: 32, retweets: 12, replies: 4, impressions: 1560 },
    },
    {
      content: "Web3 might be the next evolution of the internet, but it still needs to solve its UX problems before mass adoption can happen.",
      date: "3 days ago, 11:45 AM",
      metrics: { likes: 48, retweets: 18, replies: 7, impressions: 2340 },
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              FirasGPT
              <StatusBadge status="active" />
            </h1>
            <p className="text-sm text-muted-foreground">AI-powered tech insights and commentary</p>
          </div>
        </div>
        <Button variant="outline">
          Configure
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Tweets"
          value="18"
          icon={<Bot className="h-5 w-5 text-primary" />}
          trend={{ value: 9, positive: true }}
        />
        <StatsCard
          title="Engagement Rate"
          value="5.3%"
          icon={<BarChart2 className="h-5 w-5 text-primary" />}
          trend={{ value: 1.2, positive: true }}
        />
        <StatsCard
          title="Followers Gained"
          value="127"
          icon={<Users className="h-5 w-5 text-primary" />}
          trend={{ value: 14, positive: true }}
        />
        <StatsCard
          title="Tweet Frequency"
          value="2/day"
          icon={<Clock className="h-5 w-5 text-primary" />}
        />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full md:w-auto grid-cols-3 md:inline-flex">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <WorkflowStatus
              title="Current Workflow Status"
              steps={workflowSteps}
              progress={65}
              nextRun="Today, 5:30 PM"
            />

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>System Performance</CardTitle>
                <CardDescription>
                  Last 7 days engagement metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] flex items-center justify-center">
                  <p className="text-muted-foreground">Analytics visualization placeholder</p>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Recent Tweets</CardTitle>
              <CardDescription>
                Latest content from FirasGPT
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentTweets.map((tweet, index) => (
                <TweetCard
                  key={index}
                  content={tweet.content}
                  date={tweet.date}
                  metrics={tweet.metrics}
                />
              ))}
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">View All Tweets</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="content" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Content Strategy</CardTitle>
              <CardDescription>
                Topics and content themes that FirasGPT covers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Primary Topics</h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      Artificial Intelligence
                    </span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      Web Development
                    </span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      Tech Trends
                    </span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      Software Engineering
                    </span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      Product Management
                    </span>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Content Ideas</h3>
                  <div className="space-y-2">
                    {[
                      "The impact of AI on software development productivity",
                      "Emerging frontend frameworks and their adoption",
                      "Balancing tech debt and feature development",
                      "Building products with a user-centric approach",
                      "Scaling engineering teams effectively"
                    ].map((idea, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5" />
                        <span className="text-sm">{idea}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="configuration" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
              <CardDescription>
                FirasGPT settings and parameters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Posting Schedule</h3>
                  <p className="text-sm text-muted-foreground">
                    Currently set to post twice daily at 10:00 AM and 4:00 PM.
                  </p>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Content Parameters</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Language Model</p>
                      <p className="text-sm">GPT-4o</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Temperature</p>
                      <p className="text-sm">0.7</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Max Tokens</p>
                      <p className="text-sm">280</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Style Persona</p>
                      <p className="text-sm">Technical yet approachable</p>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">API Connections</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-sm">Twitter API</p>
                      <StatusBadge status="active" />
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-sm">OpenAI API</p>
                      <StatusBadge status="active" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-3">
              <Button variant="outline">Reset Defaults</Button>
              <Button>Save Changes</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FirasGptPage;
