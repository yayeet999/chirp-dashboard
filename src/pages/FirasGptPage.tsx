
import React, { useState, useEffect, useRef } from "react";
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
  const [sonarFactChecked, setSonarFactChecked] = useState<string>("");
  const [cleanedSonar, setCleanedSonar] = useState<string>("");
  const [isProcessingContext, setIsProcessingContext] = useState<boolean>(false);
  const [isPollingData, setIsPollingData] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  // Function to poll for data updates
  const pollForDataUpdates = async (recordId: string) => {
    if (!recordId || isPollingData) return;
    
    setIsPollingData(true);
    setErrorMessage(null);
    
    let pollCount = 0;
    const maxPolls = 20; // Set a reasonable limit to prevent endless polling
    const pollInterval = 3000; // Poll every 3 seconds
    
    const intervalId = setInterval(async () => {
      pollCount++;
      console.log(`Polling for data updates (attempt ${pollCount}/${maxPolls})...`);
      
      try {
        const { data: updatedRecord, error: fetchError } = await supabase
          .from('tweetgenerationflow')
          .select('geminiobservation, vectorcontext, sonardeepresearch, sonarfactchecked, cleanedsonar')
          .eq('id', recordId)
          .maybeSingle();
          
        if (fetchError) {
          console.error("Error fetching record data:", fetchError);
          
          // Only show toast error if this is the first poll or a new error
          if (pollCount === 1) {
            toast({
              title: "Data Fetch Error",
              description: fetchError.message,
              variant: "destructive"
            });
          }
          return;
        }
        
        if (!updatedRecord) {
          console.warn(`Record ${recordId} not found`);
          return;
        }
        
        // Track what data we've updated
        let dataUpdated = false;
        
        // Handle geminiobservation
        if (updatedRecord.geminiobservation && !geminiObservation) {
          setGeminiObservation(updatedRecord.geminiobservation);
          dataUpdated = true;
          
          toast({
            title: "Gemini Analysis Complete",
            description: "Gemini has selected the top observation",
            variant: "default"
          });
        }
        
        // Handle vectorcontext
        if (updatedRecord.vectorcontext && vectorContext.length === 0) {
          try {
            const parsedVectorContext = JSON.parse(updatedRecord.vectorcontext);
            setVectorContext(parsedVectorContext);
            dataUpdated = true;
            
            toast({
              title: "Vector Context Available",
              description: `${parsedVectorContext.length} vector matches found`,
              variant: "default"
            });
          } catch (parseError) {
            console.error("Error parsing vector context:", parseError);
          }
        }
        
        // Handle sonardeepresearch
        if (updatedRecord.sonardeepresearch && !sonarResearch) {
          setSonarResearch(updatedRecord.sonardeepresearch);
          dataUpdated = true;
          
          toast({
            title: "Research Complete",
            description: "Sonar deep research has been loaded",
            variant: "default"
          });
        }
        
        // Handle sonarfactchecked
        if (updatedRecord.sonarfactchecked && !sonarFactChecked) {
          setSonarFactChecked(updatedRecord.sonarfactchecked);
          dataUpdated = true;
          
          toast({
            title: "Fact Checking Complete",
            description: "Research has been fact-checked",
            variant: "default"
          });
        }
        
        // Handle cleanedsonar
        if (updatedRecord.cleanedsonar && !cleanedSonar) {
          setCleanedSonar(updatedRecord.cleanedsonar);
          dataUpdated = true;
          
          toast({
            title: "Text Cleaning Complete",
            description: "Research has been cleaned and chunked",
            variant: "default"
          });
        }
        
        // If we've collected all the data, or reached the maximum polls, stop polling
        const hasAllData = 
          updatedRecord.geminiobservation && 
          updatedRecord.vectorcontext && 
          updatedRecord.sonardeepresearch && 
          updatedRecord.sonarfactchecked && 
          updatedRecord.cleanedsonar;
          
        if (hasAllData || pollCount >= maxPolls) {
          clearInterval(intervalId);
          setIsPollingData(false);
          
          if (pollCount >= maxPolls && !hasAllData) {
            console.warn("Reached maximum poll attempts without getting all data");
            
            // Show what's missing
            const missing = [];
            if (!updatedRecord.geminiobservation) missing.push("Gemini observation");
            if (!updatedRecord.vectorcontext) missing.push("Vector context");
            if (!updatedRecord.sonardeepresearch) missing.push("Research");
            if (!updatedRecord.sonarfactchecked) missing.push("Fact check");
            if (!updatedRecord.cleanedsonar) missing.push("Cleaned text");
            
            if (missing.length > 0) {
              const missingText = missing.join(", ");
              setErrorMessage(`Some data is still being processed: ${missingText}`);
              
              toast({
                title: "Processing Timeout",
                description: `Some data is still being processed: ${missingText}`,
                variant: "default"
              });
            }
          }
        }
        
        // If any data was updated, update the UI
        if (dataUpdated) {
          console.log("Data updated from polling");
        }
      } catch (error) {
        console.error("Error during data polling:", error);
        clearInterval(intervalId);
        setIsPollingData(false);
        
        toast({
          title: "Polling Error",
          description: error instanceof Error ? error.message : "An unknown error occurred",
          variant: "destructive"
        });
      }
    }, pollInterval);
    
    // Return a cleanup function that clears the interval
    return () => {
      clearInterval(intervalId);
      setIsPollingData(false);
    };
  };

  useEffect(() => {
    // Start polling when we get a record ID
    if (analysisRecordId) {
      // Store the cleanup function
      const cleanup = pollForDataUpdates(analysisRecordId);
      
      // Return a cleanup function for the effect
      return () => {
        if (cleanup) {
          cleanup();
        }
      };
    }
  }, [analysisRecordId]); // Only re-run if the recordId changes

  const runDeepAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisResult("");
    setAnalysisRecordId(null);
    setGeminiObservation("");
    setVectorContext([]);
    setSonarResearch("");
    setSonarFactChecked("");
    setCleanedSonar("");
    setErrorMessage(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('gem_initialanalyzer');
      
      if (error) {
        console.error("Error running gem analysis:", error);
        toast({
          title: "Analysis Failed",
          description: error.message || "Failed to run gem analysis",
          variant: "destructive"
        });
        setErrorMessage(`Analysis failed: ${error.message || "Unknown error"}`);
        return;
      }
      
      if (data?.analysis) {
        setAnalysisResult(data.analysis);
        
        if (data.recordId) {
          setAnalysisRecordId(data.recordId);
          toast({
            title: "Analysis Complete",
            description: "Deep analysis completed. Now waiting for Gemini processing...",
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
      setErrorMessage(`Analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`);
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
    setErrorMessage(null);

    try {
      toast({
        title: "Processing Context",
        description: "Sending request to process context data...",
        variant: "default"
      });
      
      console.log("Sending request to process context with recordId:", analysisRecordId);
      
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
        setErrorMessage(`Context processing failed: ${error.message || "Unknown error"}`);
        return;
      }

      console.log("Context processing response:", data);

      if (data?.success) {
        toast({
          title: "Context Processing Started",
          description: `Processing started with ${data.vectorMatchCount || 0} vector matches`,
          variant: "default"
        });
        
        // Start polling for updates
        pollForDataUpdates(analysisRecordId);
      } else {
        toast({
          title: "Context Processing Issue",
          description: "Process started but did not return expected success message",
          variant: "default"
        });
      }
    } catch (error) {
      console.error("Failed to process context:", error);
      toast({
        title: "Context Processing Failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
      setErrorMessage(`Context processing failed: ${error instanceof Error ? error.message : "Unknown error"}`);
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
                disabled={isAnalyzing || isPollingData}
                className="w-full md:w-auto"
              >
                {isAnalyzing ? "Analyzing..." : "Run Deep Analysis"} 
              </Button>
              
              <Button 
                onClick={processVectorAndResearch} 
                disabled={isProcessingContext || !geminiObservation || isPollingData}
                variant={isProcessingContext ? "secondary" : "outline"}
                className="w-full md:w-auto relative"
              >
                {isProcessingContext ? (
                  <>
                    <span className="animate-pulse">Processing Context...</span>
                    <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-blue-500 animate-ping"></span>
                  </>
                ) : "Process Context Data"} 
              </Button>
              
              {isPollingData && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse mr-2"></div>
                  Polling for updates...
                </div>
              )}
            </div>
            
            {errorMessage && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                {errorMessage}
              </div>
            )}
            
            {analysisResult && (
              <div className="mt-4">
                <Tabs defaultValue="deepseek" className="w-full">
                  <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="deepseek">DeepSeek Analysis</TabsTrigger>
                    <TabsTrigger value="gemini">Gemini Top Pick</TabsTrigger>
                    <TabsTrigger value="vectorcontext" disabled={vectorContext.length === 0}>Vector Context</TabsTrigger>
                    <TabsTrigger value="sonarresearch" disabled={!sonarResearch}>Sonar Research</TabsTrigger>
                    <TabsTrigger value="sonarfactchecked" disabled={!sonarFactChecked}>Fact Checked</TabsTrigger>
                    <TabsTrigger value="cleanedsonar" disabled={!cleanedSonar}>Cleaned Text</TabsTrigger>
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
                        {isAnalyzing || isPollingData ? 
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
                  <TabsContent value="sonarfactchecked" className="p-4 bg-secondary/10 rounded-lg mt-2">
                    <h3 className="text-sm font-medium mb-2">Fact-Checked Research</h3>
                    {sonarFactChecked ? (
                      <div className="whitespace-pre-wrap text-sm">{sonarFactChecked}</div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        "Fact-checked research will be automatically loaded after the research is complete."
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="cleanedsonar" className="p-4 bg-secondary/10 rounded-lg mt-2">
                    <h3 className="text-sm font-medium mb-2">Cleaned Research Text</h3>
                    {cleanedSonar ? (
                      <div className="whitespace-pre-wrap text-sm">{cleanedSonar}</div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        "Cleaned research text will be automatically loaded after fact-checking is complete."
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
