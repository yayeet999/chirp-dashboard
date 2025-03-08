
import React, { useState, useEffect } from "react";
import { Bot, Users, MessageCircle, FileText, User, Hash, BookOpen, ArrowUpRight, Database, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/dashboard/StatusBadge";
import CollectedContent from "@/components/dashboard/CollectedContent";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VectorInput from "@/components/dashboard/VectorInput";

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
  const [currentGroup, setCurrentGroup] = useState<string>("");
  const [centralTime, setCentralTime] = useState<string>("");

  useEffect(() => {
    const determineActiveGroup = () => {
      const now = new Date();
      // Adjust to Central Time (UTC-6)
      const centralTimeOffset = -6 * 60; // -6 hours in minutes
      const centralTimeMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + centralTimeOffset;
      // Convert back to hours and minutes, handling day boundaries
      let hours = Math.floor(centralTimeMinutes / 60);
      if (hours < 0) hours += 24;
      if (hours >= 24) hours -= 24;
      
      const minutes = centralTimeMinutes % 60 < 0 ? centralTimeMinutes % 60 + 60 : centralTimeMinutes % 60;
      
      // Format the time as HH:MM
      const formattedHours = hours.toString().padStart(2, '0');
      const formattedMinutes = Math.abs(minutes).toString().padStart(2, '0');
      setCentralTime(`${formattedHours}:${formattedMinutes} CT`);
      
      // Determine which group is active based on Central Time
      if ((hours >= 6 && hours < 11) || (hours >= 16 && hours < 21)) {
        setCurrentGroup("Group A (6am-11am, 4pm-9pm CT)");
      } else {
        setCurrentGroup("Group B (11am-4pm, 9pm-6am CT)");
      }
    };

    determineActiveGroup();
    const interval = setInterval(determineActiveGroup, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);

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
            <p className="text-sm text-muted-foreground">AI content analytics</p>
          </div>
        </div>
      </div>

      {/* Current Status */}
      <Card className="glass-card border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Current Status
            </CardTitle>
            <CardDescription>
              Twitter API data collection status
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-secondary/10 rounded-lg">
              <h3 className="text-sm font-medium mb-1">Current Time</h3>
              <p className="text-lg font-bold">{centralTime}</p>
            </div>
            <div className="p-4 bg-secondary/10 rounded-lg">
              <h3 className="text-sm font-medium mb-1">Active Collection</h3>
              <p className="text-lg font-bold">{currentGroup}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Featured Content Section */}
      <Card className="glass-card border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Latest AI Content
            </CardTitle>
            <CardDescription>
              Collected data from Twitter API (User Timelines, excluding replies)
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <CollectedContent limit={1} featured={true} />
        </CardContent>
      </Card>

      {/* Data Source Metrics - User Timeline Data */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" />
            User Timeline Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              title="User Accounts"
              value="22"
              icon={<Users className="h-5 w-5 text-primary" />}
            />
            <MetricCard
              title="Active Group"
              value={currentGroup.split(" ")[1]}
              icon={<MessageCircle className="h-5 w-5 text-primary" />}
            />
          </div>
        </CardContent>
      </Card>

      {/* Vector Database Input Section */}
      <VectorInput />
    </div>
  );
};

export default FirasGptPage;
