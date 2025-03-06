
import React from "react";
import { 
  Bot, 
  Twitter, 
  BarChart2, 
  Clock, 
  CircleCheck 
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import StatsCard from "@/components/dashboard/StatsCard";
import WorkflowStatus from "@/components/dashboard/WorkflowStatus";
import TweetCard from "@/components/dashboard/TweetCard";

const DashboardHomePage: React.FC = () => {
  // Placeholder data with correct type for status
  const workflowSteps = [
    { name: "Content Generation", status: "completed" as const, time: "09:30 AM" },
    { name: "Review & Edit", status: "completed" as const, time: "10:15 AM" },
    { name: "Scheduled for Posting", status: "in-progress" as const },
    { name: "Analytics Collection", status: "pending" as const },
  ];
  
  const recentTweets = [
    {
      content: "AI is transforming how we interact with technology. What are your thoughts on the future of AI-driven interfaces?",
      date: "Today, 2:30 PM",
      metrics: { likes: 24, retweets: 8, replies: 6, impressions: 1240 },
    },
    {
      content: "Just published a new article on optimizing machine learning models for production environments. Check it out!",
      date: "Yesterday, 4:45 PM",
      metrics: { likes: 42, retweets: 15, replies: 3, impressions: 2150 },
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Active Systems"
          value="1"
          icon={<Bot className="h-5 w-5 text-primary" />}
          description="1 AI system running"
        />
        <StatsCard
          title="Total Posts"
          value="28"
          icon={<Twitter className="h-5 w-5 text-primary" />}
          trend={{ value: 12, positive: true }}
        />
        <StatsCard
          title="Engagement Rate"
          value="4.2%"
          icon={<BarChart2 className="h-5 w-5 text-primary" />}
          trend={{ value: 0.8, positive: true }}
        />
        <StatsCard
          title="Uptime"
          value="99.8%"
          icon={<Clock className="h-5 w-5 text-primary" />}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="glass-card md:col-span-2">
          <CardHeader>
            <CardTitle>System Overview</CardTitle>
            <CardDescription>
              Status of your active Twitter automation systems
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border p-4 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">FirasGPT</h3>
                  <p className="text-sm text-muted-foreground">AI-powered tech insights</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="status-indicator status-active"></div>
                <span className="text-sm">Active</span>
              </div>
            </div>
            
            <div className="text-muted-foreground text-sm">
              Add more AI Twitter systems to expand your automation capabilities.
            </div>
          </CardContent>
        </Card>

        <WorkflowStatus
          title="Current Workflow Status"
          steps={workflowSteps}
          progress={60}
          nextRun="Today, 4:30 PM"
        />

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Recent Tweets</CardTitle>
            <CardDescription>
              Latest content published by your AI systems
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
        </Card>
      </div>
    </div>
  );
};

export default DashboardHomePage;
