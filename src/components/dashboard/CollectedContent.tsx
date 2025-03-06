
import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator"; 
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface CollectedContentItem {
  id: string;
  source: string;
  content_type: string;
  title: string;
  summary: string;
  published_date: string;
  topics: string[];
  relevance_score: number;
  created_at: string;
}

const CollectedContent: React.FC = () => {
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
        .limit(5);
      
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
  }, []);
  
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
  
  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Latest AI Content</CardTitle>
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
            {content.map((item) => (
              <div key={item.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg">{item.title}</h3>
                  <Badge variant="secondary">
                    Score: {item.relevance_score}
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground mb-1">
                  {new Date(item.created_at).toLocaleString()}
                </p>
                
                <div className="flex flex-wrap gap-1 mb-3">
                  {item.topics.map((topic, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {topic}
                    </Badge>
                  ))}
                </div>
                
                <Separator className="my-3" />
                
                <div className="max-h-40 overflow-y-auto text-sm">
                  <p className="whitespace-pre-line">{item.summary.substring(0, 300)}...</p>
                </div>
              </div>
            ))}
            
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
