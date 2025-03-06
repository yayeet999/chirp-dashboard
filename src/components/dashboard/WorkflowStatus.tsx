
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Clock } from "lucide-react";

interface WorkflowStep {
  name: string;
  status: "completed" | "in-progress" | "pending";
  time?: string;
}

interface WorkflowStatusProps {
  title: string;
  steps: WorkflowStep[];
  progress: number;
  nextRun?: string;
}

export const WorkflowStatus: React.FC<WorkflowStatusProps> = ({
  title,
  steps,
  progress,
  nextRun,
}) => {
  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        {nextRun && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
            <Clock className="h-4 w-4" />
            <span>Next run: {nextRun}</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        
        <div className="space-y-3 mt-6">
          {steps.map((step, index) => (
            <React.Fragment key={index}>
              {index > 0 && <Separator className="my-3" />}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className={`h-3 w-3 rounded-full ${
                      step.status === "completed" 
                        ? "bg-green-500" 
                        : step.status === "in-progress" 
                          ? "bg-blue-500 animate-pulse" 
                          : "bg-gray-300"
                    }`}
                  />
                  <span className={`text-sm ${
                    step.status === "completed" 
                      ? "text-foreground font-medium" 
                      : step.status === "in-progress" 
                        ? "text-foreground" 
                        : "text-muted-foreground"
                  }`}>
                    {step.name}
                  </span>
                </div>
                {step.time && (
                  <span className="text-xs text-muted-foreground">{step.time}</span>
                )}
              </div>
            </React.Fragment>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkflowStatus;
