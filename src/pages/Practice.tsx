import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { areWordsSimilar, isFillerWord } from "@/utils/wordMatching";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Play, RotateCcw, Presentation, Lock, Unlock, X, Square } from "lucide-react";
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
    hesitationThreshold: 5,
    firstWordHesitationThreshold: 6,
  });
  const [averageWordDelay, setAverageWordDelay] = useState<number>(2000); // Track user's average pace
  const wordTimingsRef = useRef<number[]>([]); // Store recent word timing intervals
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
    wordTimingsRef.current = []; // Reset pace tracking
    setAverageWordDelay(2000); // Reset to default pace
    
    // Clear any existing hesitation timer
    if (hesitationTimerRef.current) {
      clearTimeout(hesitationTimerRef.current);
      hesitationTimerRef.current = null;
    }
    
    // Set up speech recognition
    await setupSpeechRecognition();
  };

  const setupSpeechRecognition = async () => {
    try {
      // Detect language from speech text
      const { detectTextLanguage } = await import('@/utils/languageDetection');
      const detectedLang = detectTextLanguage(speech!.text_current) || 'en';
      console.log('🌍 Detected language:', detectedLang);
      
      // Start Web Speech API for instant transcription
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
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
                
                // Ignore filler words completely
                if (cleanSpokenWord && isFillerWord(cleanSpokenWord)) {
                  console.log('🔇 Ignoring filler word:', cleanSpokenWord);
                  continue;
                }
                
                if (cleanSpokenWord && newIndex < allExpectedWords.length) {
                  const wasSupportWordShowing = supportWord !== null;
                  const previousSupportWordIndex = supportWordIndex;
                  
                  const expectedWord = allExpectedWords[newIndex];
                  const cleanExpectedWord = expectedWord.toLowerCase().replace(/[^\w]/g, '');
                  
                  console.log('🔍 Comparing:', cleanSpokenWord, 'vs', cleanExpectedWord, 'at index', newIndex);
                  
                  // Use strict word matching from shared utility
                  const isMatch = areWordsSimilar(cleanSpokenWord, cleanExpectedWord);
                  
                  if (isMatch) {
                    // MATCH - hide support word and process
                    setSupportWord(null);
                    setSupportWordIndex(null);
                    
                    // Check if this word was shown as support word
                    if (wasSupportWordShowing && previousSupportWordIndex === newIndex) {
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
                    
                    // Clear any hesitation timer
                    if (hesitationTimerRef.current) {
                      clearTimeout(hesitationTimerRef.current);
                      hesitationTimerRef.current = null;
                    }
                    
                    // Move to next expected word
                    newIndex++;
                    const currentTime = Date.now();
                    const timeSinceLastWord = currentTime - lastWordTimeRef.current;
                    lastWordTimeRef.current = currentTime;
                    
                    // Track word timing for adaptive pace - use last 5 timings for faster response
                    if (newIndex > 1 && timeSinceLastWord < 8000) { // Ignore extreme pauses > 8s
                      wordTimingsRef.current.push(timeSinceLastWord);
                      // Keep only last 5 timings for faster adaptation
                      if (wordTimingsRef.current.length > 5) {
                        wordTimingsRef.current.shift();
                      }
                      // Calculate average pace, filtering outliers
                      const validTimings = wordTimingsRef.current.filter(t => t < 8000);
                      if (validTimings.length > 0) {
                        const avgPace = validTimings.reduce((a, b) => a + b, 0) / validTimings.length;
                        setAverageWordDelay(avgPace);
                        console.log('📊 Average speaking pace:', Math.round(avgPace), 'ms per word');
                      }
                    }
                    
                    // Check if we've reached the last word - automatically stop recording
                    if (newIndex >= allExpectedWords.length) {
                      console.log('🎉 Last word spoken! Auto-stopping recording...');
                      // Stop recording automatically
                      setTimeout(() => {
                        if (audioRecorderRef.current) {
                          audioRecorderRef.current.stopRecording();
                        }
                      }, 500); // Small delay to ensure last word is fully processed
                    } else {
                      // Adaptive hesitation threshold based on user's speaking pace
                      const basePace = averageWordDelay + 1500; // Add 1.5s buffer to average pace
                      const configuredThreshold = settings.hesitationThreshold * 1000;
                      const adaptiveThreshold = Math.max(basePace, configuredThreshold);
                      
                      console.log('⏱️ Adaptive threshold:', Math.round(adaptiveThreshold), 'ms (base:', Math.round(basePace), 'configured:', configuredThreshold, ')');
                      
                      const capturedIndex = newIndex;
                      hesitationTimerRef.current = setTimeout(() => {
                        // Show support word and mark it yellow immediately
                        const wordToShow = allExpectedWords[capturedIndex];
                        setSupportWord(wordToShow);
                        setSupportWordIndex(capturedIndex);
                        setHesitatedWordsIndices(prev => new Set([...prev, capturedIndex]));
                        console.log('💡 Support word shown (marked yellow):', wordToShow, 'at index:', capturedIndex);
                        
                        // Track hesitation for segment
                        const segmentIndex = Math.floor((capturedIndex / allExpectedWords.length) * 10);
                        setSegmentHesitations(prev => {
                          const updated = new Map(prev);
                          updated.set(segmentIndex, (updated.get(segmentIndex) || 0) + 1);
                          return updated;
                        });
                      }, adaptiveThreshold);
                    }
                  } else {
                    // NO MATCH
                    console.log('⚠️ Spoken word mismatch:', cleanSpokenWord, 'vs expected:', cleanExpectedWord);
                    
                    // If support word was showing, handle it specially
                    if (wasSupportWordShowing && previousSupportWordIndex !== null) {
                      // Remove from hesitated (yellow) and mark as red (missed)
                      setHesitatedWordsIndices(prev => {
                        const updated = new Set(prev);
                        updated.delete(previousSupportWordIndex);
                        return updated;
                      });
                      setMissedWordsIndices(prev => new Set([...prev, previousSupportWordIndex]));
                      console.log('❌ Support word not spoken correctly (red):', allExpectedWords[previousSupportWordIndex], 'at index', previousSupportWordIndex);
                      
                      // Hide the support popup now that it's resolved
                      setSupportWord(null);
                      setSupportWordIndex(null);
                      
                      // Move exactly one word ahead (no jumping)
                      newIndex = previousSupportWordIndex + 1;
                      lastWordTimeRef.current = Date.now();
                      
                      // Check if this new spoken word matches the next expected word
                      if (newIndex < allExpectedWords.length) {
                        const nextExpectedWord = allExpectedWords[newIndex];
                        if (areWordsSimilar(cleanSpokenWord, nextExpectedWord)) {
                          // It matches the next word! Mark it correct and advance
                          setSpokenWordsIndices(prev => new Set([...prev, newIndex]));
                          console.log('✓ Matched next word after skip:', nextExpectedWord);
                          newIndex++;
                        }
                        
                        // Start hesitation timer for the current position
                        if (newIndex < allExpectedWords.length) {
                          const basePace = averageWordDelay + 1500;
                          const configuredThreshold = settings.hesitationThreshold * 1000;
                          const adaptiveThreshold = Math.max(basePace, configuredThreshold);
                          
                          const capturedIndex = newIndex;
                          hesitationTimerRef.current = setTimeout(() => {
                            const wordToShow = allExpectedWords[capturedIndex];
                            setSupportWord(wordToShow);
                            setSupportWordIndex(capturedIndex);
                            setHesitatedWordsIndices(prev => new Set([...prev, capturedIndex]));
                            console.log('💡 Support word shown:', wordToShow);
                          }, adaptiveThreshold);
                        }
                      }
                    } else {
                      // No support word showing - don't advance, just ignore this non-matching word
                      console.log('🔇 Ignoring non-matching word (not advancing index)');
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

          // Update adaptive word hiding based on performance
          try {
            const { error: hideError } = await supabase.functions.invoke('update-adaptive-word-hiding', {
              body: {
                speechId: speech!.id,
                missedWords: data.missedWords || [],
                hesitatedWords: data.delayedWords || []
              }
            });

            if (hideError) {
              console.error('Error updating word hiding:', hideError);
            }
          } catch (err) {
            console.error('Failed to update word hiding:', err);
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

  // Focus Mode: Full-screen minimal practice view
  if (isPracticing && !showResults) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <LoadingOverlay isVisible={isProcessing} />
        
        {/* Exit button */}
        <div className="absolute top-4 left-4 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (isRecording) {
                audioRecorderRef.current?.stopRecording();
              }
              setIsPracticing(false);
              setIsRecording(false);
            }}
            className="rounded-full hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Enhanced Support Word Prompt with Hint */}
        {supportWord && (
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none animate-fade-in">
            <div className="flex flex-col items-center gap-4">
              {/* Hint: First 2 letters */}
              <div className="bg-primary/10 text-primary px-6 py-3 rounded-full backdrop-blur-sm border border-primary/30 animate-pulse">
                <p className="text-sm font-medium">
                  Hint: {supportWord.slice(0, 2)}...
                </p>
              </div>
              
              {/* Full support word */}
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 text-black px-12 py-8 rounded-2xl shadow-2xl border-4 border-yellow-400 animate-scale-in relative">
                <div className="absolute -top-3 -left-3 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                  Support Word
                </div>
                <p className="text-6xl font-bold text-center tracking-wide">
                  {supportWord}
                </p>
                <p className="text-center text-sm text-gray-600 mt-2">
                  Say this word to continue
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Centered text content */}
        <div className="flex-1 flex items-center justify-center px-8 pb-32">
          <div className="max-w-3xl w-full">
            <BracketedTextDisplay
              text={speech.text_original}
              visibilityPercent={speech.base_word_visibility_percent || 100}
              spokenWordsIndices={spokenWordsIndices}
              hesitatedWordsIndices={hesitatedWordsIndices}
              missedWordsIndices={missedWordsIndices}
              currentWordIndex={expectedWordIndex}
              isRecording={isRecording}
              averageWordDelay={averageWordDelay}
              supportWordShowing={supportWord !== null}
            />
          </div>
        </div>

        {/* Bottom recording button */}
        <div className="fixed bottom-8 left-0 right-0 flex justify-center">
          <Button
            size="lg"
            onClick={async () => {
              if (isRecording) {
                // Stop recording
                if (audioRecorderRef.current) {
                  audioRecorderRef.current.stopRecording();
                }
                // Stop speech recognition
                if (recognitionRef.current) {
                  recognitionRef.current.stop();
                }
              } else {
                // Start recording and speech recognition
                await handleRecordingStart();
                if (audioRecorderRef.current) {
                  await audioRecorderRef.current.startRecording();
                }
              }
            }}
            disabled={isProcessing}
            className="rounded-full px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-shadow"
          >
            {isRecording ? (
              <>
                <Square className="h-5 w-5 mr-2" />
                Stop Recording
              </>
            ) : (
              <>
                <Play className="h-5 w-5 mr-2" />
                Start Recording
              </>
            )}
          </Button>
        </div>

        {/* Hidden audio recorder */}
        <div className="hidden">
          <AudioRecorder
            ref={audioRecorderRef}
            isRecording={isRecording}
            onStart={handleRecordingStart}
            onStop={handleRecordingStop}
            disabled={isProcessing}
          />
        </div>
      </div>
    );
  }

  // Analysis screen: Clean, minimal results view
  if (showResults && sessionResults) {
    return (
      <div className="min-h-screen bg-white">
        <LoadingOverlay isVisible={isProcessing} />
        
        {/* Exit button */}
        <div className="absolute top-4 left-4 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="rounded-full hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Centered analysis content */}
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2 text-gray-900">Practice Complete</h1>
            <p className="text-lg text-gray-600">Here's how you did</p>
          </div>

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
          </div>

          <div className="flex justify-center mt-8">
            <Button
              size="lg"
              onClick={() => navigate("/dashboard")}
              className="rounded-full px-8"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Pre-practice screen: Start screen with lock/unlock
  return (
    <div className="min-h-screen bg-background">
      <LoadingOverlay isVisible={isProcessing} />
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              {speech && (
                <>
                  <div className="border-l pl-4 hidden md:block">
                    <h1 className="text-lg font-semibold capitalize">{speech.title}</h1>
                    {speech.goal_date && (
                      <p className="text-sm text-muted-foreground">
                        Goal: {format(new Date(speech.goal_date), "PPP")}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/presentation/${id}`)}
              >
                <Presentation className="h-4 w-4 mr-2" />
                Presentation Mode
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Progress</CardTitle>
              <CardDescription>Track your memorization journey</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Words Memorized</span>
                  <span className="font-medium">{(() => {
                  const originalWords = speech.text_original.split(/\s+/).filter(w => w.length > 0).length;
                  const currentWords = speech.text_current.split(/\s+/).filter(w => w.length > 0).length;
                  const wordsMemorized = Math.max(0, originalWords - currentWords);
                  return originalWords > 0 ? Math.round((wordsMemorized / originalWords) * 100) : 0;
                })()}%</span>
                </div>
                <Progress value={(() => {
                  const originalWords = speech.text_original.split(/\s+/).filter(w => w.length > 0).length;
                  const currentWords = speech.text_current.split(/\s+/).filter(w => w.length > 0).length;
                  const wordsMemorized = Math.max(0, originalWords - currentWords);
                  return originalWords > 0 ? Math.round((wordsMemorized / originalWords) * 100) : 0;
                })()} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
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
                    className="rounded-full px-8"
                  >
                    <Play className="h-5 w-5 mr-2" />
                    Start Practice
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Practice;
