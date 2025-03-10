import React, { useState, useEffect } from "react";
import { Bot, Users, MessageCircle, FileText, User, Hash, BookOpen, ArrowUpRight, Database, Clock, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/dashboard/StatusBadge";
import CollectedContent from "@/components/dashboard/CollectedContent";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VectorInput from "@/components/dashboard/VectorInput";
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
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [analysisRecordId, setAnalysisRecordId] = useState<string | null>(null);
  const [geminiObservation, setGeminiObservation] = useState<string>("");
  const [vectorContext, setVectorContext] = useState<any[]>([]);
  const [sonarResearch, setSonarResearch] = useState<string>("");
  const [isProcessingContext, setIsProcessingContext] = useState<boolean>(false);
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

  useEffect(() => {
    const checkForContextData = async () => {
      if (analysisRecordId && geminiObservation) {
        try {
          setTimeout(async () => {
            const { data: updatedRecord, error: fetchError } = await supabase
              .from('tweetgenerationflow')
              .select('vectorcontext, sonardeepresearch')
              .eq('id', analysisRecordId)
              .single();
              
            if (fetchError) {
              console.error("Error fetching context data:", fetchError);
              return;
            }
            
            if (updatedRecord) {
              try {
                if (updatedRecord.vectorcontext) {
                  const parsedVectorContext = JSON.parse(updatedRecord.vectorcontext);
                  setVectorContext(parsedVectorContext);
                  
                  toast({
                    title: "Vector Context Available",
                    description: "Vector search results have been loaded",
                    variant: "default"
                  });
                }
                
                if (updatedRecord.sonardeepresearch) {
                  setSonarResearch(updatedRecord.sonardeepresearch);
                  
                  toast({
                    title: "Research Complete",
                    description: "Sonar deep research has been loaded",
                    variant: "default"
                  });
                }
              } catch (parseError) {
                console.error("Error parsing context data:", parseError);
              }
            }
          }, 10000); // Check after 10 seconds to allow processing time
        } catch (error) {
          console.error("Failed to check for context data:", error);
        }
      }
    };
    
    checkForContextData();
  }, [geminiObservation, analysisRecordId, toast]);

  const runDeepAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisResult("");
    setAnalysisRecordId(null);
    setGeminiObservation("");
    setVectorContext([]);
    setSonarResearch("");
    
    try {
      const { data, error } = await supabase.functions.invoke('deep_initialanalyzer');
      
      if (error) {
        console.error("Error running deep analysis:", error);
        toast({
          title: "Analysis Failed",
          description: error.message || "Failed to run deep analysis",
          variant: "destructive"
        });
        return;
      }
      
      if (data?.analysis) {
        setAnalysisResult(data.analysis);
        if (data.recordId) {
          setAnalysisRecordId(data.recordId);
          
          setTimeout(async () => {
            try {
              const { data: recordData, error: recordError } = await supabase
                .from('tweetgenerationflow')
                .select('geminiobservation')
                .eq('id', data.recordId)
                .single();
                
              if (recordError) {
                console.error("Error fetching Gemini observation:", recordError);
                return;
              }
              
              if (recordData?.geminiobservation) {
                setGeminiObservation(recordData.geminiobservation);
                toast({
                  title: "Gemini Analysis Complete",
                  description: "Gemini has selected the top observation",
                  variant: "default"
                });
              }
            } catch (fetchError) {
              console.error("Failed to fetch Gemini observation:", fetchError);
            }
          }, 5000); // Check after 5 seconds
        }
        
        toast({
          title: "Analysis Complete",
          description: "Deep analysis completed successfully",
          variant: "default"
        });
      }
    } catch (error) {
      console.error("Failed to run deep analysis:", error);
      toast({
        title: "Analysis Failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const processVectorAndResearch = async () => {
    if (!analysisRecordId || !geminiObservation) {
      toast({
        title: "Missing Data",
        description: "Need Gemini observation first. Run analysis first.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessingContext(true);
    setVectorContext([]);
    setSonarResearch("");

    try {
      const { data, error } = await supabase.functions.invoke('pretweetcontext', {
        body: { recordId: analysisRecordId }
      });

      if (error) {
        console.error("Error processing context:", error);
        toast({
          title: "Context Processing Failed",
          description: error.message || "Failed to process context data",
          variant: "destructive"
        });
        return;
      }

      if (data?.success) {
        toast({
          title: "Context Processing Started",
          description: `Processing started with ${data.vectorMatchCount || 0} vector matches`,
          variant: "default"
        });

        setTimeout(async () => {
          const { data: updatedRecord, error: fetchError } = await supabase
            .from('tweetgenerationflow')
            .select('vectorcontext, sonardeepresearch')
            .eq('id', analysisRecordId)
            .single();
            
          if (fetchError) {
            console.error("Error fetching context data:", fetchError);
            return;
          }
          
          if (updatedRecord) {
            try {
              if (updatedRecord.vectorcontext) {
                const parsedVectorContext = JSON.parse(updatedRecord.vectorcontext);
                setVectorContext(parsedVectorContext);
                
                toast({
                  title: "Vector Context Available",
                  description: "Vector search results have been loaded",
                  variant: "default"
                });
              }
              
              if (updatedRecord.sonardeepresearch) {
                setSonarResearch(updatedRecord.sonardeepresearch);
                
                toast({
                  title: "Research Complete",
                  description: "Sonar deep research has been loaded",
                  variant: "default"
                });
              }
            } catch (parseError) {
              console.error("Error parsing context data:", parseError);
            }
          }
        }, 5000);
      }
    } catch (error) {
      console.error("Failed to process context:", error);
      toast({
        title: "Context Processing Failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsProcessingContext(false);
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
            <div className="flex flex-col md:flex-row gap-4">
              <Button 
                onClick={runDeepAnalysis} 
                disabled={isAnalyzing}
                className="w-full md:w-auto"
              >
                {isAnalyzing ? "Analyzing..." : "Run Deep Analysis"} 
              </Button>
              
              <Button 
                onClick={processVectorAndResearch} 
                disabled={isProcessingContext || !geminiObservation}
                variant="outline"
                className="w-full md:w-auto"
              >
                {isProcessingContext ? "Processing..." : "Process Context Data"} 
              </Button>
            </div>
            
            {analysisResult && (
              <div className="mt-4">
                <Tabs defaultValue="deepseek" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="deepseek">DeepSeek Analysis</TabsTrigger>
                    <TabsTrigger value="gemini">Gemini Top Pick</TabsTrigger>
                    <TabsTrigger value="vectorcontext" disabled={vectorContext.length === 0}>Vector Context</TabsTrigger>
                    <TabsTrigger value="sonarresearch" disabled={!sonarResearch}>Sonar Research</TabsTrigger>
                  </TabsList>
                  <TabsContent value="deepseek" className="p-4 bg-secondary/10 rounded-lg mt-2">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-sm font-medium">DeepSeek Analysis</h3>
                      {analysisRecordId && (
                        <span className="text-xs text-muted-foreground">ID: {analysisRecordId}</span>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap text-sm">{analysisResult}</div>
                  </TabsContent>
                  <TabsContent value="gemini" className="p-4 bg-secondary/10 rounded-lg mt-2">
                    <h3 className="text-sm font-medium mb-2">Gemini Selected Observation</h3>
                    {geminiObservation ? (
                      <div className="whitespace-pre-wrap text-sm">{geminiObservation}</div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        {isAnalyzing ? 
                          "Waiting for Gemini analysis to complete..." : 
                          "No Gemini observation available yet. Please wait or run the analysis again."}
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="vectorcontext" className="p-4 bg-secondary/10 rounded-lg mt-2">
                    <h3 className="text-sm font-medium mb-2">Vector Search Results</h3>
                    {vectorContext.length > 0 ? (
                      <div className="space-y-4">
                        {vectorContext.map((item, index) => (
                          <div key={index} className="p-3 bg-background/80 rounded border border-border">
                            <div className="flex justify-between mb-1">
                              <span className="text-xs font-medium">Source: {item.source}</span>
                              <span className="text-xs text-muted-foreground">Relevance: {(item.score * 100).toFixed(1)}%</span>
                            </div>
                            <p className="text-sm">{item.text}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        "Vector context will be automatically loaded after Gemini analysis completes."
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="sonarresearch" className="p-4 bg-secondary/10 rounded-lg mt-2">
                    <h3 className="text-sm font-medium mb-2">Perplexity Sonar Deep Research</h3>
                    {sonarResearch ? (
                      <div className="whitespace-pre-wrap text-sm">{sonarResearch}</div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        "Sonar research will be automatically loaded after Gemini analysis completes."
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
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

      <VectorInput />
    </div>
  );
};

export default FirasGptPage;
