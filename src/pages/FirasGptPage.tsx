
import React from "react";
import { Bot, Users, MessageCircle, Heart, BarChart2, Repeat, TrendingUp, Eye, ArrowUpRight, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import StatusBadge from "@/components/dashboard/StatusBadge";
import CollectedContent from "@/components/dashboard/CollectedContent";

const MetricCard = ({ title, value, icon, trend }: { 
  title: string; 
  value: string; 
  icon: React.ReactNode;
  trend?: { value: string; up?: boolean } 
}) => (
  <Card className="overflow-hidden">
    <CardContent className="p-6">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            <h4 className="text-2xl font-bold">{value}</h4>
            {trend && (
              <div className={`flex items-center text-xs font-medium ${trend.up ? 'text-green-500' : 'text-muted-foreground'}`}>
                {trend.up && <ArrowUpRight className="h-3 w-3 mr-1" />}
                {trend.value}
              </div>
            )}
          </div>
        </div>
        <div className="p-2 bg-primary/10 rounded-full">
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
);

const FirasGptPage: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              FirasGPT Analytics
              <StatusBadge status="active" />
            </h1>
            <p className="text-sm text-muted-foreground">Tweet performance metrics</p>
          </div>
        </div>
      </div>

      {/* Featured Content Section - NEW */}
      <Card className="glass-card border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Latest Sonar-API Search Results
            </CardTitle>
            <CardDescription>
              Most recent data collected from Perplexity API
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <CollectedContent limit={1} featured={true} />
        </CardContent>
      </Card>

      {/* Metrics Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Impressions"
          value="N/A"
          icon={<Eye className="h-5 w-5 text-primary" />}
        />
        <MetricCard
          title="Engagements"
          value="No data yet"
          icon={<Users className="h-5 w-5 text-primary" />}
        />
        <MetricCard
          title="Likes"
          value="—"
          icon={<Heart className="h-5 w-5 text-primary" />}
        />
        <MetricCard
          title="Retweets"
          value="—"
          icon={<Repeat className="h-5 w-5 text-primary" />}
        />
      </div>

      {/* Original Content */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Performance Trends</CardTitle>
          <CardDescription>
            Tweet engagement metrics over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 border rounded-md border-dashed mb-4">
            <div className="text-center space-y-2">
              <BarChart2 className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">No performance data available yet</p>
              <Button variant="outline" size="sm">Refresh Data</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Top Performing Tweets</CardTitle>
            <CardDescription>
              Tweets with highest engagement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-36 border rounded-md border-dashed">
              <div className="text-center space-y-1">
                <TrendingUp className="h-6 w-6 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">No tweet data yet</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Recent Replies</CardTitle>
            <CardDescription>
              Latest interactions with your tweets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-36 border rounded-md border-dashed">
              <div className="text-center space-y-1">
                <MessageCircle className="h-6 w-6 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">No replies yet</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Audience Insights</CardTitle>
          <CardDescription>Demographics and interests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <h3 className="text-sm font-medium mb-2">Location</h3>
              <div className="flex items-center justify-center h-40 border rounded-md border-dashed">
                <p className="text-muted-foreground">No location data available</p>
              </div>
            </div>
            <Separator className="md:h-auto hidden md:block" orientation="vertical" />
            <div className="flex-1">
              <h3 className="text-sm font-medium mb-2">Interests</h3>
              <div className="flex items-center justify-center h-40 border rounded-md border-dashed">
                <p className="text-muted-foreground">No interest data available</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FirasGptPage;
