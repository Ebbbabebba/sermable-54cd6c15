import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Play, RotateCcw, Presentation, Lock, Unlock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import AudioRecorder, { AudioRecorderHandle } from "@/components/AudioRecorder";
import WordHighlighter from "@/components/WordHighlighter";
import PracticeResults from "@/components/PracticeResults";
import EnhancedWordTracker from "@/components/EnhancedWordTracker";
import BracketedTextDisplay from "@/components/BracketedTextDisplay";
import PracticeSettings, { PracticeSettingsConfig } from "@/components/PracticeSettings";
import LoadingOverlay from "@/components/LoadingOverlay";
import LockCountdown from "@/components/LockCountdown";

interface Speech {
  id: string;
  title: string;
  text_original: string;
  text_current: string;
  goal_date: string;
  base_word_visibility_percent: number | null;
}

interface SessionResults {
  transcription: string;
  accuracy: number;
  missedWords: string[];
  delayedWords: string[];
  connectorWords: string[];
  difficultyScore: number;
  analysis: string;
  cueText: string;
}

const Practice = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const resultsRef = useRef<HTMLDivElement>(null);
  const [speech, setSpeech] = useState<Speech | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPracticing, setIsPracticing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionResults, setSessionResults] = useState<SessionResults | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'student' | 'regular' | 'enterprise'>('free');
  const [skillLevel, setSkillLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [isLocked, setIsLocked] = useState(false);
  const [nextReviewDate, setNextReviewDate] = useState<Date | null>(null);
  const [overrideLock, setOverrideLock] = useState(false);
  const [settings, setSettings] = useState<PracticeSettingsConfig>({
    revealSpeed: 5,
    showWordOnPause: true,
    animationStyle: 'playful',
    keywordMode: false,
    hesitationThreshold: 2,
    firstWordHesitationThreshold: 4,
  });
  const [liveTranscription, setLiveTranscription] = useState("");
  const [spokenWordsIndices, setSpokenWordsIndices] = useState<Set<number>>(new Set());
  const [hesitatedWordsIndices, setHesitatedWordsIndices] = useState<Set<number>>(new Set());
  const [missedWordsIndices, setMissedWordsIndices] = useState<Set<number>>(new Set());
  const [completedSegments, setCompletedSegments] = useState<Set<number>>(new Set());
  const [segmentErrors, setSegmentErrors] = useState<Map<number, number>>(new Map());
  const [segmentHesitations, setSegmentHesitations] = useState<Map<number, number>>(new Map());
  const [expectedWordIndex, setExpectedWordIndex] = useState(0);
  const [lastProcessedTranscriptLength, setLastProcessedTranscriptLength] = useState(0);
  const [supportWord, setSupportWord] = useState<string | null>(null);
  const [supportWordIndex, setSupportWordIndex] = useState<number | null>(null);
  const lastWordTimeRef = useRef<number>(Date.now());
  const hesitationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRecorderRef = useRef<AudioRecorderHandle>(null);
  const transcriptionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedChunkIndex = useRef(0);
  const recognitionRef = useRef<any>(null);
  const audioFormatRef = useRef<string>('audio/webm');

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("subscription_tier, skill_level")
          .eq("id", user.id)
          .single();

        if (profile) {
          setSubscriptionTier(profile.subscription_tier);
          setSkillLevel((profile.skill_level || 'beginner') as 'beginner' | 'intermediate' | 'advanced');
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    };

    loadUserProfile();
  }, []);

  useEffect(() => {
    loadSpeech();
  }, [id]);

  const loadSpeech = async () => {
    try {
      const { data, error } = await supabase
        .from("speeches")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setSpeech(data);
      
      // Check lock status with adaptive learning integration
      const { data: schedule } = await supabase
        .from("schedules")
        .select("next_review_date, interval_days")
        .eq("speech_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
        
      if (schedule?.next_review_date) {
        const reviewDate = new Date(schedule.next_review_date);
        setNextReviewDate(reviewDate);
        
        console.log('🔒 Lock status check:', {
          nextReviewDate: reviewDate,
          now: new Date(),
          isInFuture: reviewDate > new Date(),
          subscriptionTier,
          intervalDays: schedule.interval_days
        });
        
        // Lock for free users when review date is in future (adaptive interval)
        if (subscriptionTier === 'free' && reviewDate > new Date()) {
          setIsLocked(true);
          console.log('🔒 Speech locked until:', reviewDate);
        } else {
          setIsLocked(false);
          console.log('🔓 Speech unlocked');
        }
      } else {
        // No schedule yet, allow practice
        setIsLocked(false);
        console.log('📝 No schedule found, allowing practice');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading speech",
        description: error.message,
      });
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleStartPractice = () => {
    // Check if locked and not overridden
    if (isLocked && !overrideLock && subscriptionTier === 'free') {
      console.log('🚫 Practice blocked - speech is locked');
      toast({
        variant: "destructive",
        title: "Speech Locked",
        description: `This speech is scheduled for review ${nextReviewDate ? format(nextReviewDate, 'MMM dd, yyyy \'at\' HH:mm') : 'soon'}. The adaptive learning system has determined the optimal practice timing based on your performance.`,
        duration: 6000,
      });
      return;
    }
    
    console.log('✅ Starting practice session');
    setIsPracticing(true);
    setShowResults(false);
    setSessionResults(null);
    toast({
      title: "Practice mode activated",
      description: "Read your speech aloud when ready, then start recording.",
    });
  };
  
  const handleOverrideLock = () => {
    setOverrideLock(true);
    setIsPracticing(true);
    setShowResults(false);
    setSessionResults(null);
    toast({
      title: "Practice session activated",
      description: "Read your speech aloud when ready, then start recording.",
    });
  };

  const handleSegmentComplete = (segmentIndex: number) => {
    console.log('✅ Segment completed:', segmentIndex);
    
    // Calculate segment-specific performance
    const errors = segmentErrors.get(segmentIndex) || 0;
    const hesitations = segmentHesitations.get(segmentIndex) || 0;
    const totalIssues = errors + hesitations;
    
    console.log(`📊 Segment ${segmentIndex} performance: ${errors} errors, ${hesitations} hesitations`);
    
    // Mark segment as completed
    setCompletedSegments(prev => new Set([...prev, segmentIndex]));
    
    // If this was a difficult segment (many errors/hesitations), the overall
    // session accuracy will reflect this and adaptive learning will adjust accordingly
    if (totalIssues > 3) {
      console.log(`⚠️ Segment ${segmentIndex} had significant difficulty - this will be reflected in session accuracy`);
    }
  };

  const handleRecordingStart = async () => {
    console.log('=== handleRecordingStart CALLED ===');
    setIsRecording(true);
    setLiveTranscription("");
    lastProcessedChunkIndex.current = 0;
    setExpectedWordIndex(0);
    setLastProcessedTranscriptLength(0);
    setSupportWord(null);
    setSupportWordIndex(null);
    lastWordTimeRef.current = Date.now();
    
    // Clear any existing hesitation timer
    if (hesitationTimerRef.current) {
      clearTimeout(hesitationTimerRef.current);
      hesitationTimerRef.current = null;
    }
    
    try {
      // Detect iOS/iPad to determine audio format
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      // Determine audio format for recording
      let audioFormat = 'audio/webm';
      if (isIOS) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          audioFormat = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          audioFormat = 'audio/aac';
        } else if (MediaRecorder.isTypeSupported('audio/mpeg')) {
          audioFormat = 'audio/mpeg';
        }
      }
      audioFormatRef.current = audioFormat;
      console.log('🎙️ Recording with format:', audioFormat);
      
      // Detect language from speech text
      const { detectTextLanguage } = await import('@/utils/languageDetection');
      const detectedLang = detectTextLanguage(speech!.text_current) || 'en';
      console.log('🌍 Detected language:', detectedLang);
      
      // Start Web Speech API for instant transcription on ALL devices
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      console.log('🔍 SpeechRecognition available?', !!SpeechRecognition);
      
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;
        recognition.lang = detectedLang === 'sv' ? 'sv-SE' : detectedLang === 'en' ? 'en-US' : 'en-US';
        
        console.log('📝 Recognition configured with lang:', recognition.lang);
        
        let finalTranscript = '';
        
        recognition.onresult = (event: any) => {
          console.log('✅ Speech recognition result received!', event.results.length);
          let interimTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            console.log('📢 Transcript:', transcript, 'isFinal:', event.results[i].isFinal);
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
              setLiveTranscription(finalTranscript.trim());
              console.log('✔️ Final transcript updated:', finalTranscript.trim());
            } else {
              interimTranscript += transcript;
              setLiveTranscription((finalTranscript + interimTranscript).trim());
              console.log('⏳ Interim transcript:', (finalTranscript + interimTranscript).trim());
            }
          }
          
          // Track spoken words for bracket visualization
          const fullTranscript = (finalTranscript + interimTranscript).trim();
          const transcriptWords = fullTranscript.toLowerCase().split(/\s+/).filter(w => w.trim());
          
          // Get expected words from the original speech
          const allExpectedWords = speech!.text_original.toLowerCase().split(/\s+/).map(w => w.replace(/[^\w]/g, ''));
          
          // Only process NEW words from the transcript (not already processed)
          setLastProcessedTranscriptLength(prevLength => {
            const newWords = transcriptWords.slice(prevLength);
            
            if (newWords.length === 0) {
              return prevLength; // No new words
            }
            
            console.log('🆕 New words detected:', newWords, 'Previous length:', prevLength);
            
            // Process new words sequentially
            setExpectedWordIndex(currentIndex => {
              let newIndex = currentIndex;
              
              for (const word of newWords) {
                const cleanSpokenWord = word.toLowerCase().replace(/[^\w]/g, '');
                
                if (cleanSpokenWord && newIndex < allExpectedWords.length) {
                  const expectedWord = allExpectedWords[newIndex];
                  const cleanExpectedWord = expectedWord.toLowerCase().replace(/[^\w]/g, '');
                  
                  console.log('🔍 Comparing:', cleanSpokenWord, 'vs', cleanExpectedWord, 'at index', newIndex);
                  
                  // Check if the spoken word matches the expected word (more flexible matching)
                  const isExactMatch = cleanSpokenWord === cleanExpectedWord;
                  const isPartialMatch = cleanSpokenWord.includes(cleanExpectedWord) || 
                                        cleanExpectedWord.includes(cleanSpokenWord);
                  const isSimilar = cleanSpokenWord.length > 2 && cleanExpectedWord.length > 2 &&
                                   (cleanSpokenWord.startsWith(cleanExpectedWord.slice(0, 3)) ||
                                    cleanExpectedWord.startsWith(cleanSpokenWord.slice(0, 3)));
                  
                  if (isExactMatch || isPartialMatch || isSimilar) {
                    // Check if this word was shown as support word
                    if (supportWordIndex === newIndex) {
                      // User said it correctly after support word - mark yellow
                      setHesitatedWordsIndices(prev => new Set([...prev, newIndex]));
                      console.log('✓ Support word spoken correctly (yellow):', expectedWord, 'at index', newIndex);
                    } else {
                      // Normal correct word - mark as spoken
                      setSpokenWordsIndices(prev => new Set([...prev, newIndex]));
                      // Remove from missed/hesitated if it was marked before
                      setMissedWordsIndices(prev => {
                        const updated = new Set(prev);
                        updated.delete(newIndex);
                        return updated;
                      });
                      setHesitatedWordsIndices(prev => {
                        const updated = new Set(prev);
                        updated.delete(newIndex);
                        return updated;
                      });
                      console.log('✓ Word spoken correctly:', expectedWord, 'at index', newIndex);
                    }
                    
                    // Hide support word if any
                    setSupportWord(null);
                    setSupportWordIndex(null);
                    
                    // Clear any hesitation timer
                    if (hesitationTimerRef.current) {
                      clearTimeout(hesitationTimerRef.current);
                      hesitationTimerRef.current = null;
                    }
                    
                    // Move to next expected word
                    newIndex++;
                    lastWordTimeRef.current = Date.now();
                    
                    // Start hesitation timer for next word (shows support word after 2s)
                    if (newIndex < allExpectedWords.length) {
                      const threshold = 2000; // Always 2 seconds for support word
                      const capturedIndex = newIndex;
                      hesitationTimerRef.current = setTimeout(() => {
                        // Show support word instead of just marking as hesitated
                        const wordToShow = allExpectedWords[capturedIndex];
                        setSupportWord(wordToShow);
                        setSupportWordIndex(capturedIndex);
                        console.log('💡 Support word shown:', wordToShow, 'at index:', capturedIndex);
                        
                        // Track hesitation for segment
                        const segmentIndex = Math.floor((capturedIndex / allExpectedWords.length) * 10);
                        setSegmentHesitations(prev => {
                          const updated = new Map(prev);
                          updated.set(segmentIndex, (updated.get(segmentIndex) || 0) + 1);
                          return updated;
                        });
                        
                        // Remove hesitation marker after 2 seconds
                        setTimeout(() => {
                          setHesitatedWordsIndices(prev => {
                            const updated = new Set(prev);
                            updated.delete(capturedIndex);
                            return updated;
                          });
                        }, 2000);
                      }, threshold);
                    }
                  } else {
                    // Word doesn't match - show support word and handle next word logic
                    console.log('⚠️ Spoken word mismatch:', cleanSpokenWord, 'vs expected:', cleanExpectedWord);
                    
                    // If support word is showing, this is the "next word" that should hide it
                    if (supportWord && supportWordIndex !== null) {
                      // Mark support word as red (missed)
                      setMissedWordsIndices(prev => new Set([...prev, supportWordIndex]));
                      console.log('❌ Support word not spoken correctly (red):', supportWord, 'at index', supportWordIndex);
                      
                      // Hide support word
                      setSupportWord(null);
                      setSupportWordIndex(null);
                      
                      // Try to find the spoken word ahead
                      let found = false;
                      const maxLookAhead = 5;
                      
                      for (let lookAhead = 1; lookAhead <= maxLookAhead && (supportWordIndex + lookAhead) < allExpectedWords.length; lookAhead++) {
                        const futureWord = allExpectedWords[supportWordIndex + lookAhead];
                        const cleanFutureWord = futureWord.toLowerCase().replace(/[^\w]/g, '');
                        
                        const isFutureMatch = cleanSpokenWord === cleanFutureWord ||
                                             cleanSpokenWord.includes(cleanFutureWord) ||
                                             cleanFutureWord.includes(cleanSpokenWord);
                        
                        if (isFutureMatch) {
                          found = true;
                          setSpokenWordsIndices(prev => new Set([...prev, supportWordIndex + lookAhead]));
                          newIndex = supportWordIndex + lookAhead + 1;
                          console.log('✓ Found word after support word skip:', futureWord);
                          lastWordTimeRef.current = Date.now();
                          
                          // Start hesitation timer for next word
                          if (newIndex < allExpectedWords.length) {
                            const threshold = 2000;
                            const capturedIndex = newIndex;
                            hesitationTimerRef.current = setTimeout(() => {
                              const wordToShow = allExpectedWords[capturedIndex];
                              setSupportWord(wordToShow);
                              setSupportWordIndex(capturedIndex);
                              console.log('💡 Support word shown:', wordToShow);
                            }, threshold);
                          }
                          break;
                        }
                      }
                      
                      if (!found) {
                        newIndex = supportWordIndex + 1;
                      }
                    } else {
                      // No support word showing - first incorrect word, show support word
                      const wordToShow = allExpectedWords[newIndex];
                      setSupportWord(wordToShow);
                      setSupportWordIndex(newIndex);
                      console.log('💡 Support word shown after incorrect word:', wordToShow, 'at index:', newIndex);
                      // Don't advance index yet - wait for next word
                    }
                  }
                }
              }
              
              return newIndex;
            });
            
            return transcriptWords.length; // Update processed length
          });
        };
        
        recognition.onerror = (event: any) => {
          console.error('❌ Speech recognition error:', event.error, event);
          if (event.error === 'no-speech') {
            console.log('⚠️ No speech detected, continuing...');
          }
        };
        
        recognition.onstart = () => {
          console.log('🎤 Speech recognition STARTED successfully');
        };
        
        recognition.onend = () => {
          console.log('🛑 Speech recognition ENDED');
        };
        
        try {
          recognition.start();
          recognitionRef.current = recognition;
          console.log('✨ Web Speech API started for instant word tracking');
        } catch (startError) {
          console.error('❌ Error starting recognition:', startError);
        }
      } else {
        console.warn('⚠️ Web Speech API not supported on this device');
        toast({
          title: "Limited Support",
          description: "Real-time word tracking is not available on this device. Your speech will be analyzed after recording.",
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('❌ Error in handleRecordingStart:', error);
    }
  };

  const handleRecordingStop = async (audioBlob: Blob) => {
    setIsRecording(false);
    setIsProcessing(true);
    
    // Stop Web Speech API
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    
    // Clear hesitation timer
    if (hesitationTimerRef.current) {
      clearTimeout(hesitationTimerRef.current);
      hesitationTimerRef.current = null;
    }
    
    // Clear the transcription interval
    if (transcriptionIntervalRef.current) {
      clearInterval(transcriptionIntervalRef.current);
      transcriptionIntervalRef.current = null;
    }
    lastProcessedChunkIndex.current = 0;
    
    // Reset spoken words tracking
    setSpokenWordsIndices(new Set());
    setHesitatedWordsIndices(new Set());
    setMissedWordsIndices(new Set());
    setCompletedSegments(new Set());
    setSegmentErrors(new Map());
    setSegmentHesitations(new Map());
    setExpectedWordIndex(0);
    setLastProcessedTranscriptLength(0);

    // Scroll to results area
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);

    try {
      // Validate audio blob
      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('No audio data recorded. Please try again.');
      }

      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        try {
          const base64Audio = (reader.result as string).split(',')[1];

          if (!base64Audio) {
            throw new Error('Failed to process audio. Please try again.');
          }

          toast({
            title: "Processing...",
            description: "AI is analyzing your practice session",
          });

          // Detect language from speech text
          const { detectTextLanguage } = await import('@/utils/languageDetection');
          const detectedLang = detectTextLanguage(speech!.text_current) || 'en';
          console.log('Using language for analysis:', detectedLang);

          // Get current session for auth
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error('No active session. Please log in again.');
          }

          // Call the edge function with auth token
          const { data, error } = await supabase.functions.invoke('analyze-speech', {
            body: {
              audio: base64Audio,
              originalText: speech!.text_original, // Always analyze against FULL original speech
              speechId: speech!.id,
              userTier: subscriptionTier,
              language: detectedLang,
              skillLevel: skillLevel,
            },
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          });

          if (error) {
            console.error('Edge function error:', error);
            throw new Error(error.message || 'Failed to analyze speech');
          }

          if (!data) {
            throw new Error('No response from analysis service');
          }

          setSessionResults(data);
          
          // Delay showing results for smooth transition
          setTimeout(() => {
            setIsProcessing(false);
            setShowResults(true);
          }, 500);

          // Save practice session to database
          const { error: sessionError } = await supabase
            .from('practice_sessions')
            .insert({
              speech_id: speech!.id,
              score: data.accuracy,
              missed_words: data.missedWords,
              delayed_words: data.delayedWords,
              difficulty_score: data.difficultyScore,
              connector_words: data.connectorWords,
              duration: 0,
            });

          if (sessionError) {
            console.error('Error saving session:', sessionError);
          }

          // Update adaptive learning metrics
          try {
            const { data: adaptiveData, error: adaptiveError } = await supabase.functions.invoke('update-adaptive-learning', {
              body: {
                speechId: speech!.id,
                sessionAccuracy: data.accuracy,
                wordVisibilityPercent: speech!.base_word_visibility_percent || 100
              }
            });

            if (adaptiveError) {
              console.error('Error updating adaptive learning:', adaptiveError);
            } else if (adaptiveData) {
              console.log('Adaptive learning updated:', adaptiveData);
              
              // Show detailed adaptation info to user
              const ruleExplanation = {
                increasing_interval: '✅ Excellent memorization! Increasing practice interval.',
                keeping_short: '📖 High accuracy but still using script. Keeping interval short.',
                shortening_interval: '💪 Struggling detected. Shortening interval for more practice.',
                moderate: '🔄 Moderate progress. Standard adjustment applied.'
              }[adaptiveData.adaptationRule || 'moderate'];
              
              const weightInfo = `Raw: ${adaptiveData.rawAccuracy}% → Weighted: ${adaptiveData.weightedAccuracy}% (${adaptiveData.performanceWeight}% weight due to ${adaptiveData.currentVisibility}% script visibility)`;
              
              const intervalInfo = adaptiveData.intervalMinutes < 60 
                ? `${adaptiveData.intervalMinutes} minutes`
                : adaptiveData.intervalMinutes < 24 * 60
                ? `${Math.round(adaptiveData.intervalMinutes / 60)} hours`
                : `${Math.round(adaptiveData.intervalMinutes / (24 * 60))} days`;
              
              toast({
                title: "🎯 Adaptive Training Update",
                description: (
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold">{ruleExplanation}</p>
                    <p>{weightInfo}</p>
                    <div className="border-t border-border pt-2 mt-2">
                      <p className="font-semibold text-xs text-muted-foreground mb-1">AUTOMATIC ADJUSTMENTS:</p>
                      <p>⏱️ Next: {adaptiveData.automationSummary?.nextSessionTiming}</p>
                      <p>📏 Segment: {adaptiveData.automationSummary?.nextSegmentSize}</p>
                      <p>👁️ Visibility: {adaptiveData.automationSummary?.nextScriptSupport}</p>
                      <p className="text-xs text-muted-foreground mt-1">{adaptiveData.automationSummary?.deadlineStatus}</p>
                    </div>
                    <p className="text-muted-foreground mt-2 border-t border-border pt-2">{adaptiveData.recommendation}</p>
                  </div>
                ),
                duration: 10000,
              });
            }
          } catch (adaptiveErr) {
            console.error('Failed to update adaptive learning:', adaptiveErr);
          }

          // Update speech with new cue text
          const { error: updateError } = await supabase
            .from('speeches')
            .update({ text_current: data.cueText })
            .eq('id', speech!.id);

          if (updateError) {
            console.error('Error updating speech:', updateError);
          } else {
            loadSpeech();
          }

          toast({
            title: "Analysis complete!",
            description: `${data.accuracy}% accuracy. Check your results below.`,
          });
        } catch (innerError: any) {
          console.error('Error in analysis:', innerError);
          toast({
            variant: "destructive",
            title: "Analysis failed",
            description: innerError.message || "Failed to analyze your recording. Please try again.",
          });
          setIsProcessing(false);
        }
      };

      reader.onerror = () => {
        toast({
          variant: "destructive",
          title: "Processing failed",
          description: "Failed to read audio file. Please try again.",
        });
        setIsProcessing(false);
      };

    } catch (error: any) {
      console.error('Error processing recording:', error);
      toast({
        variant: "destructive",
        title: "Processing failed",
        description: error.message || "Failed to process your recording. Please try again.",
      });
      setIsProcessing(false);
    }
  };

  const handleNewSession = () => {
    setShowResults(false);
    setSessionResults(null);
    setIsPracticing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!speech) return null;

  return (
    <div className="min-h-screen">
      <LoadingOverlay isVisible={isProcessing} />
      
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/presentation/${id}`)}>
            <Presentation className="h-4 w-4 mr-2" />
            Enter Presentation Mode
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <div className="animate-fade-in">
            <h1 className="text-4xl font-bold mb-2">{speech.title}</h1>
            <p className="text-muted-foreground">
              Practice session • {speech.text_current.split(/\s+/).filter(Boolean).length} words
            </p>
          </div>

          {/* Ad Placeholder - Free Users */}
          {subscriptionTier === 'free' && (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="flex items-center justify-center py-6">
                <p className="text-sm text-muted-foreground">Ad Space - Upgrade to remove ads</p>
              </CardContent>
            </Card>
          )}

          <PracticeSettings settings={settings} onSettingsChange={setSettings} />

          <Card>
            <CardHeader>
              <CardTitle>Session Progress</CardTitle>
              <CardDescription>Track your practice performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Memorization</span>
                  <span className="font-medium">
                    {(() => {
                      const originalWords = speech.text_original.split(/\s+/).filter(w => w.length > 0).length;
                      const currentWords = speech.text_current.split(/\s+/).filter(w => w.length > 0).length;
                      const wordsMemorized = Math.max(0, originalWords - currentWords);
                      const memorizationProgress = originalWords > 0 ? Math.round((wordsMemorized / originalWords) * 100) : 0;
                      return `${memorizationProgress}%`;
                    })()}
                  </span>
                </div>
                <Progress value={(() => {
                  const originalWords = speech.text_original.split(/\s+/).filter(w => w.length > 0).length;
                  const currentWords = speech.text_current.split(/\s+/).filter(w => w.length > 0).length;
                  const wordsMemorized = Math.max(0, originalWords - currentWords);
                  return originalWords > 0 ? Math.round((wordsMemorized / originalWords) * 100) : 0;
                })()} />
              </div>
              {sessionResults && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Last Session Accuracy</span>
                    <span className="font-medium">{sessionResults.accuracy}%</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {!showResults && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Practice Mode</CardTitle>
                    <CardDescription>
                      {!isPracticing
                        ? "Click start to begin your practice session"
                        : isRecording
                        ? "Recording... speak clearly"
                        : isProcessing
                        ? "AI is analyzing your performance..."
                        : "Read the text aloud and record yourself"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {!isPracticing ? (
                  <div className="text-center py-12 space-y-4">
                    {isLocked && !overrideLock && (
                      <div className="mb-4 p-4 bg-muted rounded-lg">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Lock className="h-5 w-5 text-muted-foreground" />
                          <p className="font-medium">
                            Done for today
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Come back{" "}
                          {nextReviewDate && (
                            <LockCountdown 
                              nextReviewDate={nextReviewDate} 
                              className="font-medium text-foreground" 
                            />
                          )}
                          {" "}to practice again
                        </p>
                        {subscriptionTier !== 'free' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-3"
                            onClick={handleOverrideLock}
                          >
                            <Unlock className="h-4 w-4 mr-2" />
                            Practice Anyway
                          </Button>
                        )}
                        {subscriptionTier === 'free' && (
                          <p className="text-xs text-muted-foreground mt-3">
                            Upgrade to premium to practice anytime
                          </p>
                        )}
                      </div>
                    )}
                    {(!isLocked || overrideLock) && (
                      <Button 
                        size="lg" 
                        onClick={handleStartPractice}
                      >
                        <Play className="h-5 w-5 mr-2" />
                        Start Practice Session
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="p-6 bg-muted/30 rounded-lg">
                      <div className="space-y-4">
                        {isRecording && (
                          <div className="text-center mb-4">
                            <p className="text-sm text-muted-foreground">
                              🎤 Recall the words in the brackets from memory
                            </p>
                          </div>
                        )}
                        
                        {/* Support Word Prompt */}
                        {supportWord && (
                          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
                            <div className="bg-yellow-100 dark:bg-yellow-900/50 text-black dark:text-yellow-100 px-12 py-8 rounded-2xl shadow-2xl border-4 border-yellow-400 dark:border-yellow-600 animate-scale-in">
                              <p className="text-6xl font-bold text-center uppercase tracking-wide">
                                {supportWord}
                              </p>
                            </div>
                          </div>
                        )}
                        
                        <BracketedTextDisplay
                          text={speech.text_original}
                          visibilityPercent={speech.base_word_visibility_percent || 100}
                          spokenWordsIndices={spokenWordsIndices}
                          hesitatedWordsIndices={hesitatedWordsIndices}
                          missedWordsIndices={missedWordsIndices}
                          currentWordIndex={expectedWordIndex}
                          isRecording={isRecording}
                        />
                      </div>
                    </div>

                    <div className="flex justify-center">
                    <AudioRecorder
                      ref={audioRecorderRef}
                      isRecording={isRecording}
                      onStart={handleRecordingStart}
                      onStop={handleRecordingStop}
                      disabled={isProcessing}
                    />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {showResults && sessionResults && (
            <div ref={resultsRef} className="animate-fade-in">
                    <PracticeResults
                      accuracy={sessionResults.accuracy}
                      missedWords={sessionResults.missedWords}
                      delayedWords={sessionResults.delayedWords}
                      analysis={sessionResults.analysis}
                      transcription={sessionResults.transcription}
                      originalText={speech.text_original}
                      currentText={speech.text_current}
                    />

              {sessionResults.cueText !== speech.text_current && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>Updated Cue Script</CardTitle>
                    <CardDescription>
                      Focus on these key words for your next practice
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-primary/5 rounded-lg">
                      <p className="text-lg leading-relaxed">
                        {sessionResults.cueText}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-3">
                      This simplified version will be used in your next practice session.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Practice;
