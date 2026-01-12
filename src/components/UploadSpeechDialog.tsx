import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar, Languages, Brain, Camera, FileText, X } from "lucide-react";
import { format } from "date-fns";
import { switchLanguageBasedOnText, detectTextLanguage } from "@/utils/languageDetection";

interface UploadSpeechDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const UploadSpeechDialog = ({ open, onOpenChange, onSuccess }: UploadSpeechDialogProps) => {
  const { t, i18n } = useTranslation();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [familiarityLevel, setFamiliarityLevel] = useState<string>("beginner");
  const [loading, setLoading] = useState(false);
  const [userTier, setUserTier] = useState<'free' | 'student' | 'regular' | 'enterprise'>('free');
  const [wordLimit, setWordLimit] = useState(500);
  const [canCreateSpeech, setCanCreateSpeech] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Cleanup camera stream when dialog closes
  useEffect(() => {
    if (!open) {
      stopCamera();
      setCapturedImage(null);
    }
  }, [open]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        variant: "destructive",
        title: t('upload.cameraError'),
        description: t('upload.cameraErrorDesc'),
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(imageData);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target?.result as string;
        setCapturedImage(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  const processScannedImage = async () => {
    if (!capturedImage) return;

    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('scan-document', {
        body: { image: capturedImage }
      });

      if (error) throw error;

      if (data?.text) {
        handleTextChange(text ? `${text}\n\n${data.text}` : data.text);
        setCapturedImage(null);
        toast({
          title: t('upload.scanSuccess'),
          description: t('upload.scanSuccessDesc'),
        });
      } else {
        throw new Error('No text extracted');
      }
    } catch (error: any) {
      console.error('Scan error:', error);
      toast({
        variant: "destructive",
        title: t('upload.scanError'),
        description: t('upload.scanErrorDesc'),
      });
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    const loadUserLimits = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get user profile with subscription info
        const { data: profile } = await supabase
          .from("profiles")
          .select("subscription_tier, monthly_speeches_count, monthly_speeches_reset_date")
          .eq("id", user.id)
          .single();

        if (profile) {
          setUserTier(profile.subscription_tier);
          
          // Get word limit
          const { data: limitData } = await supabase.rpc('get_word_limit', { 
            p_user_id: user.id 
          });
          if (limitData) setWordLimit(limitData);

          // Check if user can create speech
          const { data: canCreate } = await supabase.rpc('can_create_speech', { 
            p_user_id: user.id 
          });
          if (canCreate !== null) setCanCreateSpeech(canCreate);
        }
      } catch (error) {
        console.error('Error loading user limits:', error);
      }
    };

    if (open) {
      loadUserLimits();
    }
  }, [open]);

  const handleTextChange = (newText: string) => {
    setText(newText);
    
    // Auto-detect language and switch if different
    if (newText.length > 50) {
      const languageSwitched = switchLanguageBasedOnText(
        newText,
        i18n.language,
        i18n.changeLanguage
      );
      
      if (languageSwitched) {
        toast({
          title: t('common.success'),
          description: `${t('upload.languageDetected')} (${i18n.language.toUpperCase()})`,
          duration: 3000,
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check word count
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount > wordLimit) {
      toast({
        variant: "destructive",
        title: t('upload.error'),
        description: `Your speech has ${wordCount} words. ${userTier === 'free' ? 'Free plan' : 'Your plan'} allows up to ${wordLimit} words. ${userTier === 'free' ? 'Upgrade to premium for up to 5000 words.' : ''}`,
      });
      return;
    }

    if (!canCreateSpeech) {
      toast({
        variant: "destructive",
        title: t('upload.limitReached'),
        description: "You've reached your monthly speech limit. Free users can create 1 speech per month. Upgrade to premium for unlimited speeches.",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Detect the language of the speech text
      const detectedLanguage = detectTextLanguage(text) || 'en';
      console.log('🌍 Detected speech language:', detectedLanguage);

      const { data: newSpeech, error } = await supabase.from("speeches").insert({
        user_id: user.id,
        title,
        text_original: text,
        text_current: text,
        goal_date: goalDate,
        familiarity_level: familiarityLevel,
        speech_language: detectedLanguage,
      }).select().single();

      if (error) throw error;

      // Segment the speech automatically
      console.log('🔄 Segmenting speech...');
      const { error: segmentError } = await supabase.functions.invoke('segment-speech', {
        body: { speechId: newSpeech.id }
      });

      if (segmentError) {
        console.error('⚠️ Error segmenting speech:', segmentError);
        // Don't fail the whole process if segmentation fails
      } else {
        console.log('✅ Speech segmented successfully');
      }

      // Check memorization feasibility
      const { data: feasibilityData, error: feasibilityError } = await (supabase as any)
        .rpc('assess_memorization_feasibility', { p_speech_id: newSpeech.id });

      if (!feasibilityError && feasibilityData && Array.isArray(feasibilityData) && feasibilityData.length > 0) {
        const assessment = feasibilityData[0];
        
        // Show appropriate warning based on warning level
        if (assessment.warning_level === 'critical' || assessment.warning_level === 'emergency') {
          toast({
            variant: "destructive",
            title: "⚠️ Tight Deadline Warning",
            description: assessment.message,
            duration: 8000,
          });
        } else if (assessment.warning_level === 'challenging') {
          toast({
            title: "🔥 Intensive Practice Required",
            description: assessment.message,
            duration: 6000,
          });
        } else if (assessment.warning_level === 'tight') {
          toast({
            title: "⏰ Stay Consistent",
            description: assessment.message,
            duration: 5000,
          });
        } else {
          toast({
            title: t('upload.success'),
            description: "Your speech has been saved. Time to start practicing!",
          });
        }
      } else {
        toast({
          title: t('upload.success'),
          description: "Your speech has been saved. Time to start practicing!",
        });
      }

      // Reset form
      setTitle("");
      setText("");
      setGoalDate("");
      setFamiliarityLevel("beginner");
      onSuccess();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('upload.error'),
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Get minimum date (today)
  const minDate = format(new Date(), "yyyy-MM-dd");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('upload.title')}</DialogTitle>
          <DialogDescription>
            Add your speech text and set a goal date for when you need to have it memorized.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pb-2">
          <div className="space-y-2">
            <Label htmlFor="title">{t('upload.speechTitle')}</Label>
            <Input
              id="title"
              placeholder="e.g., Quarterly Business Review"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goalDate">{t('upload.goalDate')}</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="goalDate"
                type="date"
                className="pl-10"
                value={goalDate}
                onChange={(e) => setGoalDate(e.target.value)}
                min={minDate}
                required
              />
            </div>
            <p className="text-sm text-muted-foreground">
              When do you need to deliver this speech?
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="familiarity">How well do you know this text?</Label>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </div>
            <Select value={familiarityLevel} onValueChange={setFamiliarityLevel}>
              <SelectTrigger id="familiarity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">I don't know it at all</SelectItem>
                <SelectItem value="intermediate">I know some parts</SelectItem>
                <SelectItem value="confident">I know it very well</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              This helps us adjust the difficulty level for your practice sessions
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="text">{t('upload.speechText')}</Label>
                <Languages className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Auto-detects language
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={startCamera}
                  disabled={loading || isScanning}
                  className="gap-1.5"
                >
                  <Camera className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('upload.scanDocument')}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || isScanning}
                  className="gap-1.5"
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('upload.uploadImage')}</span>
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Camera View */}
            {showCamera && (
              <div className="relative rounded-lg overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full"
                />
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={stopCamera}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    onClick={capturePhoto}
                    className="rounded-full w-14 h-14"
                  >
                    <Camera className="h-6 w-6" />
                  </Button>
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </div>
            )}

            {/* Captured Image Preview */}
            {capturedImage && !showCamera && (
              <div className="relative rounded-lg overflow-hidden border">
                <img src={capturedImage} alt="Captured document" className="w-full" />
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setCapturedImage(null)}
                    disabled={isScanning}
                  >
                    <X className="h-4 w-4 mr-2" />
                    {t('upload.retake')}
                  </Button>
                  <Button
                    type="button"
                    onClick={processScannedImage}
                    disabled={isScanning}
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('upload.extracting')}
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        {t('upload.extractText')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            <Textarea
              id="text"
              placeholder={t('upload.pasteText')}
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              rows={12}
              required
              className="resize-none"
            />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {text.split(/\s+/).filter(Boolean).length} / {wordLimit} {t('dashboard.words')}
              </span>
              {userTier === 'free' && (
                <span className="text-xs text-muted-foreground">
                  {t('upload.wordLimit')}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t('upload.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('upload.uploading')}
                </>
              ) : (
                t('upload.upload')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UploadSpeechDialog;
