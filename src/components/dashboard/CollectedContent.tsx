
import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator"; 
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Json } from "@/integrations/supabase/types";

interface CollectedContentItem {
  id: string;
  twitter_data: string;
  created_at: string;
}

// Define a helper interface for the processed data to display in the UI
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
        description: "Triggering data collection...",
      });
      
      const { data, error } = await supabase.functions.invoke('data-collection-scheduler', {
        method: 'POST',
      });
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "Success",
        description: "Data collection has been triggered",
      });
      
      // Wait a moment and then refresh the content
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

  // Process twitter_data for display - now handling as text
  const processTwitterData = (item: CollectedContentItem): ProcessedContent => {
    if (!item.twitter_data) {
      return {
        title: "No Title Available",
        summary: "No data available",
        topics: [],
        relevance_score: 0
      };
    }

    try {
      // Since twitter_data is now a string, we need to handle it accordingly
      const content = item.twitter_data;
      
      // Default topics and relevance score
      const topics = ['AI', 'Twitter'];
      const relevance_score = 80;
      
      // Extract the first paragraph or sentence as title
      const title = content.split('\n')[0].substring(0, 100) || "Twitter Data Update";
      
      // Use the rest as summary
      const summary = content.substring(title.length).trim() || content;
      
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
    // Featured view for single item
    const featuredItem = content[0];
    const processedData = processTwitterData(featuredItem);
    
    return (
      <div className="relative">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
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
            
            <div className="prose prose-sm max-w-none">
              <h3 className="mb-2 text-lg font-medium">{processedData.title}</h3>
              <div className="whitespace-pre-line text-sm">{processedData.summary}</div>
            </div>
            
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" size="sm" onClick={handleManualCollection}>
                Trigger New Collection
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  return (
    <Card className={`${featured ? '' : 'glass-card'}`}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Latest Twitter Content</CardTitle>
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
              Trigger Data Collection
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {content.map((item) => {
              const processedData = processTwitterData(item);
              
              return (
                <div key={item.id} className="border rounded-lg p-4">
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
            })}
            
            {isLoading && (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CollectedContent;
