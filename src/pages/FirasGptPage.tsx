import React, { useState, useEffect } from "react";
import { Bot, Users, MessageCircle, FileText, User, Hash, Clock, Sparkles, Layers, Tag } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/dashboard/StatusBadge";
import CollectedContent from "@/components/dashboard/CollectedContent";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

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
                {trend.up && <span className="h-3 w-3 mr-1">↑</span>}
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
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isProcessingPretweet2, setIsProcessingPretweet2] = useState<boolean>(false);
  const [isProcessingPretweet3, setIsProcessingPretweet3] = useState<boolean>(false);
  const [isProcessingGemini, setIsProcessingGemini] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [analysisRecordId, setAnalysisRecordId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const determineActiveGroup = () => {
      const now = new Date();
      const centralTimeOffset = -6 * 60; // -6 hours in minutes
      const centralTimeMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + centralTimeOffset;
      
      let hours = Math.floor(centralTimeMinutes / 60);
      if (hours < 0) hours += 24;
      if (hours >= 24) hours -= 24;
      
      const minutes = centralTimeMinutes % 60 < 0 ? centralTimeMinutes % 60 + 60 : centralTimeMinutes % 60;
      
      const formattedHours = hours.toString().padStart(2, '0');
      const formattedMinutes = Math.abs(minutes).toString().padStart(2, '0');
      setCentralTime(`${formattedHours}:${formattedMinutes} CT`);
      
      if (hours >= 5 && hours < 7) {
        setCurrentGroup("Group A (6am CT)");
      } else if (hours >= 10 && hours < 12) {
        setCurrentGroup("Group B (11am CT)");
      } else if (hours >= 15 && hours < 17) {
        setCurrentGroup("Group C (4pm CT)");
      } else if (hours >= 20 && hours < 22) {
        setCurrentGroup("Group D (9pm CT)");
      } else {
        setCurrentGroup("No Active Group");
      }
    };

    determineActiveGroup();
    const interval = setInterval(determineActiveGroup, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);

  const runDeepAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisResult("");
    setAnalysisRecordId(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('gem_initialanalyzer');
      
      if (error) {
        console.error("Error running gem analysis:", error);
        toast({
          title: "Analysis Failed",
          description: error.message || "Failed to run gem analysis",
          variant: "destructive"
        });
        return;
      }
      
      if (data?.analysis) {
        setAnalysisResult(data.analysis);
        
        if (data.recordId) {
          setAnalysisRecordId(data.recordId);
          toast({
            title: "Analysis Complete",
            description: "Deep analysis completed successfully and full processing pipeline initiated.",
            variant: "default"
          });
        } else {
          toast({
            title: "Analysis Incomplete",
            description: "Analysis completed but no record ID was returned",
            variant: "default"
          });
        }
      } else {
        toast({
          title: "Analysis Incomplete",
          description: "Analysis completed but no results were returned",
          variant: "default"
        });
      }
    } catch (error) {
      console.error("Failed to run gem analysis:", error);
      toast({
        title: "Analysis Failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runPretweet1 = async () => {
    if (!analysisRecordId) {
      toast({
        title: "No Record ID",
        description: "Please run the deep analysis first to get a record ID",
        variant: "destructive"
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('pretweet1', {
        body: { recordId: analysisRecordId }
      });
      
      if (error) {
        console.error("Error running pretweet1:", error);
        toast({
          title: "Social Media Analysis Failed",
          description: error.message || "Failed to run social media analysis",
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Social Media Analysis Complete",
        description: "Content has been analyzed for social media angles and approaches",
        variant: "default"
      });
      
    } catch (error) {
      console.error("Failed to run pretweet1:", error);
      toast({
        title: "Social Media Analysis Failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const runPretweet2 = async () => {
    if (!analysisRecordId) {
      toast({
        title: "No Record ID",
        description: "Please run the deep analysis first to get a record ID",
        variant: "destructive"
      });
      return;
    }
    
    setIsProcessingPretweet2(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('pretweet2', {
        body: { recordId: analysisRecordId }
      });
      
      if (error) {
        console.error("Error running pretweet2:", error);
        toast({
          title: "Content Selection Failed",
          description: error.message || "Failed to run angle selection",
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Content Selection Complete",
        description: "Top two content angles have been selected successfully",
        variant: "default"
      });
      
    } catch (error) {
      console.error("Failed to run pretweet2:", error);
      toast({
        title: "Content Selection Failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsProcessingPretweet2(false);
    }
  };

  const runPretweet3 = async () => {
    if (!analysisRecordId) {
      toast({
        title: "No Record ID",
        description: "Please run the deep analysis first to get a record ID",
        variant: "destructive"
      });
      return;
    }
    
    setIsProcessingPretweet3(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('pretweet3');
      
      if (error) {
        console.error("Error running pretweet3:", error);
        toast({
          title: "Content Categorization Failed",
          description: error.message || "Failed to run content categorization",
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Content Categorization Complete",
        description: "Content has been categorized successfully for optimal tweet strategies",
        variant: "default"
      });
      
    } catch (error) {
      console.error("Failed to run pretweet3:", error);
      toast({
        title: "Content Categorization Failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsProcessingPretweet3(false);
    }
  };

  const runGeminiInitial = async () => {
    if (!analysisRecordId) {
      toast({
        title: "No Record ID",
        description: "Please run the deep analysis first to get a record ID",
        variant: "destructive"
      });
      return;
    }
    
    setIsProcessingGemini(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('geminiinitial2', {
        body: { recordId: analysisRecordId }
      });
      
      if (error) {
        console.error("Error running Gemini analysis:", error);
        toast({
          title: "Gemini Analysis Failed",
          description: error.message || "Failed to run Gemini analysis",
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Gemini Analysis Complete",
        description: "Top observation has been selected and saved",
        variant: "default"
      });
      
    } catch (error) {
      console.error("Failed to run Gemini analysis:", error);
      toast({
        title: "Gemini Analysis Failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsProcessingGemini(false);
    }
  };

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

      <Card className="glass-card border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Tweet Generation Tools
            </CardTitle>
            <CardDescription>
              Tools for analyzing content and generating tweet ideas
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 flex-wrap">
              <Button 
                onClick={runDeepAnalysis} 
                disabled={isAnalyzing}
                className="w-full md:w-auto"
              >
                {isAnalyzing ? "Analyzing..." : "Run Deep Analysis"} 
              </Button>
              
              <Button 
                onClick={runGeminiInitial} 
                disabled={isProcessingGemini || !analysisRecordId}
                variant="outline"
                className="w-full md:w-auto"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {isProcessingGemini ? "Processing..." : "Gemini Analysis"}
              </Button>
              
              <Button 
                onClick={runPretweet1} 
                disabled={isProcessing || !analysisRecordId}
                variant="outline"
                className="w-full md:w-auto"
              >
                <Layers className="h-4 w-4 mr-2" />
                {isProcessing ? "Processing..." : "Run Content Analysis"}
              </Button>
              
              <Button 
                onClick={runPretweet2} 
                disabled={isProcessingPretweet2 || !analysisRecordId}
                variant="outline"
                className="w-full md:w-auto"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {isProcessingPretweet2 ? "Selecting..." : "Select Top Angles"}
              </Button>
              
              <Button 
                onClick={runPretweet3} 
                disabled={isProcessingPretweet3 || !analysisRecordId}
                variant="outline"
                className="w-full md:w-auto"
              >
                <Tag className="h-4 w-4 mr-2" />
                {isProcessingPretweet3 ? "Categorizing..." : "Categorize Content"}
              </Button>
            </div>
            
            {analysisResult && (
              <div className="mt-4">
                <div className="p-4 bg-secondary/10 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-sm font-medium">DeepSeek Analysis</h3>
                    {analysisRecordId && (
                      <span className="text-xs text-muted-foreground">ID: {analysisRecordId}</span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap text-sm">{analysisResult}</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
              value={currentGroup !== "No Active Group" ? currentGroup.split(" ")[1] : "None"}
              icon={<MessageCircle className="h-5 w-5 text-primary" />}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FirasGptPage;

