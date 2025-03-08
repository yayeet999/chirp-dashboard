
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Database, FileText, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const VectorInput: React.FC = () => {
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!text.trim()) {
      toast.error("Please enter text to embed");
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("vector-embeddings", {
        body: {
          text: text.trim(),
          metadata: {
            source: source.trim() || "manual-input"
          }
        }
      });
      
      if (error) throw error;
      
      toast.success("Successfully added to vector database");
      setText("");
      setSource("");
    } catch (error) {
      console.error("Error inserting into vector database:", error);
      toast.error("Failed to add to vector database");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-4 w-4 text-primary" />
          Vector Database Input
        </CardTitle>
        <CardDescription>
          Add content to FirasGPT Vector Database
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="text">Text Content</Label>
            <Textarea
              id="text"
              placeholder="Paste or type content to be vectorized and stored..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[120px]"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="source">Source (optional)</Label>
            <Input
              id="source"
              placeholder="Source of the content (e.g., article, tweet)"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading || !text.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Add to Vector Database
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default VectorInput;
