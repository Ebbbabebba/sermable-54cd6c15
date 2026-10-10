import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, HelpCircle, Mic, BookOpen, Clock, BarChart3, Settings, MessageCircle, Mail, ExternalLink, Smartphone, Zap, Trophy, Shield, Copy, Check } from "lucide-react";
import { buildMailtoUrl, copyToClipboard } from "@/lib/openMailto";
import { useState } from "react";

const SUPPORT_EMAIL = "support@sermable.com";

const Help = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(SUPPORT_EMAIL);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

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
    <div className="s-l6 s-3v">
      {/* Header */}
      <header className="s-t7 s-w1 s-yh s-43 s-3d s-t8 s-6v" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="s-jc s-m9 s-os s-p7 s-c5 s-ib s-dq">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="s-g1 s-xv" />
          </Button>
          <div>
            <h1 className="s-vi s-cx">{t('help.title')}</h1>
            <p className="s-v9 s-ul">{t('help.subtitle')}</p>
          </div>
        </div>
      </header>

      <main className="s-jc s-m9 s-os s-p9 s-t3">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="s-c5 s-ib s-dn">
              <MessageCircle className="s-g1 s-xv s-uw" />
              {t('help.needMoreHelp')}
            </CardTitle>
            <CardDescription>{t('help.contactDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="s-c5 s-dn">
              <Button
                asChild
                variant="outline"
                className="s-c6 s-ii s-l8"
              >
                <a
                  href={buildMailtoUrl(SUPPORT_EMAIL)}
                  target="_blank"
                  rel="external noopener"
                >
                  <Mail className="s-fz s-xt s-lp s-r5" />
                  <span className="truncate">{SUPPORT_EMAIL}</span>
                </a>
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Copy email address"
                onClick={handleCopy}
              >
                {copied ? <Check className="s-fz s-xt s-uw" /> : <Copy className="s-fz s-xt" />}
              </Button>
            </div>
            {copied && (
              <p className="s-vj s-uw s-lv">{SUPPORT_EMAIL} copied</p>
            )}
            <p className="s-vj s-ul s-lx">
              We typically respond within 24–48 hours on business days (Monday–Friday, CET).
              Account, billing and subscription issues are prioritised.
            </p>
          </CardContent>
        </Card>

        {/* FAQ Categories */}
        <div className="s-t1">
          <h2 className="s-uk s-d3 s-c5 s-ib s-dn">
            <HelpCircle className="s-g1 s-xv s-uw" />
            {t('help.frequentlyAsked')}
          </h2>

          {faqCategories.map((category) => (
            <Card key={category.id}>
              <CardHeader className="s-n4">
                <CardTitle className="s-tw s-c5 s-ib s-dn">
                  <category.icon className="s-fz s-xt s-uw" />
                  {category.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="s-y7">
                  {category.faqs.map((faq, index) => (
                    <AccordionItem key={index} value={`${category.id}-${index}`}>
                      <AccordionTrigger className="s-uj s-v9">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="s-ul s-v9">
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
        <div className="s-t1">
          <h2 className="s-uk s-d3 s-c5 s-ib s-dn">
            <Settings className="s-g1 s-xv s-uw" />
            {t('help.troubleshootingTitle')}
          </h2>

          {troubleshooting.map((issue, index) => (
            <Card key={index}>
              <CardHeader className="s-n4">
                <CardTitle className="s-tw s-c5 s-ib s-dn">
                  <issue.icon className="s-fz s-xt s-uw" />
                  {issue.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="s-j1 s-j2 s-sy s-v9 s-ul">
                  {issue.steps.map((step, stepIndex) => (
                    <li key={stepIndex}>{step}</li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* App Version */}
        <div className="s-u0 s-v9 s-ul s-p7">
          <p>Sermable v1.0.0</p>
          <p className="s-lt">{t('help.madeWithLove')}</p>
        </div>
      </main>
    </div>
  );
};

export default Help;
