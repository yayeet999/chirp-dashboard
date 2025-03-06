
import React from "react";
import { Bot } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/dashboard/StatusBadge";

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

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>FirasGPT Overview</CardTitle>
          <CardDescription>
            Control your AI Twitter automation system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Your FirasGPT system is ready to be configured. Use the settings to customize how it operates.
          </p>
          
          <div className="flex items-center justify-between p-4 border rounded-md">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">System Status</h3>
                <p className="text-sm text-muted-foreground">Ready to tweet</p>
              </div>
            </div>
            <StatusBadge status="active" />
          </div>
          
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            <Button variant="default">Create New Tweet</Button>
            <Button variant="outline">View Settings</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FirasGptPage;
