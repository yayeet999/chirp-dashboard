import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator"; 
import { RefreshCw, User, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface CollectedContentItem {
  id: string;
  twitter_data: string;
  created_at: string;
}

interface ProcessedContent {
  title: string;
  summary: string;
  topics: string[];
  relevance_score: number;
}

interface CollectedContentProps {
  limit?: number;
  featured?: boolean;
}

const CollectedContent: React.FC<CollectedContentProps> = ({ 
  limit = 5,
  featured = false
}) => {
  const [content, setContent] = useState<CollectedContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [executionTimes, setExecutionTimes] = useState<{utc: string, central: string} | null>(null);
  const { toast } = useToast();

  const fetchCollectedContent = async () => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('collected_content')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        throw error;
      }
      
      console.log("Fetched content:", data);
      setContent(data || []);
    } catch (error) {
      console.error("Error fetching collected content:", error);
      toast({
        title: "Error",
        description: "Failed to load collected content",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchCollectedContent();
  }, [limit]);
  
  const handleManualCollection = async () => {
    try {
      toast({
        title: "Processing",
        description: "Triggering data collection with parallel processing...",
      });
      
      const { data, error } = await supabase.functions.invoke('data-collection-scheduler', {
        method: 'POST',
      });
      
      if (error) {
        throw error;
      }
      
      if (data && data.execution_time_utc && data.execution_time_central) {
        setExecutionTimes({
          utc: data.execution_time_utc,
          central: data.execution_time_central
        });
      }
      
      toast({
        title: "Success",
        description: "Parallel data collection has been triggered",
      });
      
      setTimeout(() => {
        fetchCollectedContent();
      }, 5000);
      
    } catch (error) {
      console.error("Error triggering data collection:", error);
      toast({
        title: "Error",
        description: "Failed to trigger data collection",
        variant: "destructive",
      });
    }
  };

  const processTwitterData = (text: string | null): ProcessedContent => {
    if (!text) {
      return {
        title: "No Data Available",
        summary: "No data available",
        topics: [],
        relevance_score: 0
      };
    }

    try {
      const topicRegex = /\b(AI|LLM|GPT|Claude|Mistral|Gemini|Anthropic|OpenAI|DeepMind|Llama|Grok|AGI)\b/gi;
      const matchedTopics = [...new Set(text.match(topicRegex) || [])];
      const topics = matchedTopics.length > 0 ? matchedTopics : ['AI', 'Twitter'];
      
      const relevanceWords = ['AI', 'GPT', 'LLM', 'model', 'intelligence', 'neural', 'transformer'];
      const wordCount = relevanceWords.reduce((count, word) => {
        const regex = new RegExp(word, 'gi');
        const matches = text.match(regex) || [];
        return count + matches.length;
      }, 0);
      
      const relevance_score = Math.min(100, Math.max(10, wordCount * 10));
      
      const lines = text.split('\n').filter(line => line.trim());
      const title = lines[0]?.substring(0, 100) || "Twitter Data Update";
      
      const summary = lines.slice(1).join('\n') || text;
      
      return {
        title,
        summary,
        topics,
        relevance_score
      };
    } catch (e) {
      console.error("Error processing Twitter data:", e);
      return {
        title: "Error Processing Data",
        summary: "There was an error processing this content",
        topics: ['Error'],
        relevance_score: 0
      };
    }
  };
  
  if (featured && content.length > 0) {
    const featuredItem = content[0];
    
    return (
      <div className="relative">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div>
            {renderFeaturedContent(featuredItem.twitter_data, "twitter")}

            <div className="text-sm text-muted-foreground mb-3 flex items-center justify-between">
              <span>Updated {new Date(featuredItem.created_at).toLocaleString()}</span>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-6 w-6" 
                onClick={fetchCollectedContent} 
                disabled={isLoading}
              >
                <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            
            {executionTimes && (
              <div className="text-xs text-muted-foreground mt-2 mb-3">
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Last execution: {executionTimes.central} (Central Time)
                </span>
              </div>
            )}
            
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" size="sm" onClick={handleManualCollection}>
                Trigger Parallel Collection
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  function renderFeaturedContent(text: string | null, type: "twitter") {
    const processedData = processTwitterData(text);
    
    return (
      <div>
        <div className="flex flex-wrap gap-1 mb-4">
          {processedData.topics.map((topic, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {topic}
            </Badge>
          ))}
          <Badge variant="secondary" className="ml-auto">
            Score: {processedData.relevance_score}
          </Badge>
        </div>
        
        <div className="prose prose-sm max-w-none">
          <h3 className="mb-2 text-lg font-medium">{processedData.title}</h3>
          <div className="whitespace-pre-line text-sm max-h-80 overflow-y-auto">
            {processedData.summary}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <Card className={`${featured ? '' : 'glass-card'}`}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>
          <div className="flex items-center gap-2">
            Latest AI Content
            <Badge variant="outline" className="ml-2">Parallel</Badge>
          </div>
        </CardTitle>
        <Button 
          variant="outline" 
          size="icon" 
          onClick={fetchCollectedContent} 
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {content.length === 0 && !isLoading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">No content has been collected yet</p>
            <Button onClick={handleManualCollection}>
              Trigger Parallel Data Collection
            </Button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <User className="h-4 w-4" />
              <span className="font-medium">User Timelines (Parallel Processing)</span>
            </div>
            
            {executionTimes && (
              <div className="text-xs text-muted-foreground mb-4">
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Last execution: {executionTimes.central} (Central Time)
                </span>
              </div>
            )}
            
            <div className="space-y-6">
              {content.map((item) => renderContentItem(item, 'twitter_data', 'twitter'))}
            </div>
            
            {isLoading && (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            )}
            
            <div className="mt-4 flex justify-center">
              <Button onClick={handleManualCollection} disabled={isLoading}>
                Trigger Parallel Collection
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
  
  function renderContentItem(
    item: CollectedContentItem, 
    field: 'twitter_data',
    type: 'twitter'
  ) {
    const text = item[field] || null;
    const processedData = processTwitterData(text);
    
    if (!text) {
      return (
        <div key={`${item.id}-${field}`} className="border rounded-lg p-4 text-center text-muted-foreground">
          No user timeline data available
        </div>
      );
    }
    
    return (
      <div key={`${item.id}-${field}`} className="border rounded-lg p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-lg">{processedData.title}</h3>
          <Badge variant="secondary">
            Score: {processedData.relevance_score}
          </Badge>
        </div>
        
        <p className="text-sm text-muted-foreground mb-1">
          {new Date(item.created_at).toLocaleString()}
        </p>
        
        <div className="flex flex-wrap gap-1 mb-3">
          {processedData.topics.map((topic, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {topic}
            </Badge>
          ))}
        </div>
        
        <Separator className="my-3" />
        
        <div className="max-h-40 overflow-y-auto text-sm">
          <p className="whitespace-pre-line">{processedData.summary.substring(0, 300)}...</p>
        </div>
      </div>
    );
  }
};

export default CollectedContent;
