import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, HelpCircle, Mic, BookOpen, Clock, BarChart3, Settings, MessageCircle, Mail, ExternalLink, Smartphone, Zap, Trophy, Shield } from "lucide-react";

const Help = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const faqCategories = [
    {
      id: "getting-started",
      icon: BookOpen,
      title: t('help.categories.gettingStarted'),
      faqs: [
        {
          question: t('help.faq.howToAddSpeech.question'),
          answer: t('help.faq.howToAddSpeech.answer')
        },
        {
          question: t('help.faq.whatIsBeat.question'),
          answer: t('help.faq.whatIsBeat.answer')
        },
        {
          question: t('help.faq.howManySpeeches.question'),
          answer: t('help.faq.howManySpeeches.answer')
        }
      ]
    },
    {
      id: "practice",
      icon: Mic,
      title: t('help.categories.practice'),
      faqs: [
        {
          question: t('help.faq.howPracticeWorks.question'),
          answer: t('help.faq.howPracticeWorks.answer')
        },
        {
          question: t('help.faq.whyWordsHidden.question'),
          answer: t('help.faq.whyWordsHidden.answer')
        },
        {
          question: t('help.faq.micNotWorking.question'),
          answer: t('help.faq.micNotWorking.answer')
        }
      ]
    },
    {
      id: "spaced-repetition",
      icon: Clock,
      title: t('help.categories.spacedRepetition'),
      faqs: [
        {
          question: t('help.faq.whatIsSpacedRepetition.question'),
          answer: t('help.faq.whatIsSpacedRepetition.answer')
        },
        {
          question: t('help.faq.whyWait.question'),
          answer: t('help.faq.whyWait.answer')
        },
        {
          question: t('help.faq.canPracticeEarly.question'),
          answer: t('help.faq.canPracticeEarly.answer')
        }
      ]
    },
    {
      id: "presentation",
      icon: BarChart3,
      title: t('help.categories.presentation'),
      faqs: [
        {
          question: t('help.faq.whatIsPresentation.question'),
          answer: t('help.faq.whatIsPresentation.answer')
        },
        {
          question: t('help.faq.whenUsePresentation.question'),
          answer: t('help.faq.whenUsePresentation.answer')
        }
      ]
    },
    {
      id: "streaks",
      icon: Trophy,
      title: t('help.categories.streaks'),
      faqs: [
        {
          question: t('help.faq.howStreaksWork.question'),
          answer: t('help.faq.howStreaksWork.answer')
        },
        {
          question: t('help.faq.streakReset.question'),
          answer: t('help.faq.streakReset.answer')
        }
      ]
    },
    {
      id: "account",
      icon: Shield,
      title: t('help.categories.account'),
      faqs: [
        {
          question: t('help.faq.howDeleteAccount.question'),
          answer: t('help.faq.howDeleteAccount.answer')
        },
        {
          question: t('help.faq.changeLanguage.question'),
          answer: t('help.faq.changeLanguage.answer')
        }
      ]
    }
  ];

  const troubleshooting = [
    {
      icon: Mic,
      title: t('help.troubleshooting.micIssues.title'),
      steps: [
        t('help.troubleshooting.micIssues.step1'),
        t('help.troubleshooting.micIssues.step2'),
        t('help.troubleshooting.micIssues.step3'),
        t('help.troubleshooting.micIssues.step4')
      ]
    },
    {
      icon: Zap,
      title: t('help.troubleshooting.slowPerformance.title'),
      steps: [
        t('help.troubleshooting.slowPerformance.step1'),
        t('help.troubleshooting.slowPerformance.step2'),
        t('help.troubleshooting.slowPerformance.step3')
      ]
    },
    {
      icon: Smartphone,
      title: t('help.troubleshooting.appNotLoading.title'),
      steps: [
        t('help.troubleshooting.appNotLoading.step1'),
        t('help.troubleshooting.appNotLoading.step2'),
        t('help.troubleshooting.appNotLoading.step3')
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{t('help.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('help.subtitle')}</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              {t('help.needMoreHelp')}
            </CardTitle>
            <CardDescription>{t('help.contactDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1 justify-start"
              onClick={() => window.location.href = 'mailto:support@sermable.com'}
            >
              <Mail className="h-4 w-4 mr-2" />
              {t('help.emailSupport')}
            </Button>
            <Button
              variant="outline"
              className="flex-1 justify-start"
              onClick={() => window.open('https://discord.gg/sermable', '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {t('help.joinDiscord')}
            </Button>
          </CardContent>
        </Card>

        {/* FAQ Categories */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            {t('help.frequentlyAsked')}
          </h2>

          {faqCategories.map((category) => (
            <Card key={category.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <category.icon className="h-4 w-4 text-primary" />
                  {category.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {category.faqs.map((faq, index) => (
                    <AccordionItem key={index} value={`${category.id}-${index}`}>
                      <AccordionTrigger className="text-left text-sm">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground text-sm">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Troubleshooting */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            {t('help.troubleshootingTitle')}
          </h2>

          {troubleshooting.map((issue, index) => (
            <Card key={index}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <issue.icon className="h-4 w-4 text-primary" />
                  {issue.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  {issue.steps.map((step, stepIndex) => (
                    <li key={stepIndex}>{step}</li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* App Version */}
        <div className="text-center text-sm text-muted-foreground py-4">
          <p>Sermable v1.0.0</p>
          <p className="mt-1">{t('help.madeWithLove')}</p>
        </div>
      </main>
    </div>
  );
};

export default Help;
