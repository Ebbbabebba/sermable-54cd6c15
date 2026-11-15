import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';
import { Camera, Settings } from 'lucide-react';
import { Button } from './ui/button';

const copy = {
  sv: ['Tillåt kameran', 'Kameran behövs för att fotografera ditt manus och lägga in texten i talet.', 'Öppna Inställningar', 'Tillåt kameran för Sermable i Inställningar och försök igen.', 'Tillåt kameran i webbläsarens webbplatsinställningar och försök igen.', 'Försök igen'],
  en: ['Allow camera access', 'The camera is needed to photograph your script and add its text to your speech.', 'Open Settings', 'Allow camera access for Sermable in Settings, then try again.', 'Allow the camera in your browser’s site settings, then try again.', 'Try again'],
  de: ['Kamerazugriff erlauben', 'Die Kamera wird benötigt, um dein Manuskript zu fotografieren und den Text zu deiner Rede hinzuzufügen.', 'Einstellungen öffnen', 'Erlaube Sermable den Kamerazugriff in den Einstellungen und versuche es erneut.', 'Erlaube die Kamera in den Website-Einstellungen deines Browsers und versuche es erneut.', 'Erneut versuchen'],
  fr: ['Autoriser la caméra', 'La caméra permet de photographier ton texte et de l’ajouter à ton discours.', 'Ouvrir les réglages', 'Autorise la caméra pour Sermable dans les réglages, puis réessaie.', 'Autorise la caméra dans les paramètres du site de ton navigateur, puis réessaie.', 'Réessayer'],
  es: ['Permitir la cámara', 'La cámara permite fotografiar tu guion y añadir el texto a tu discurso.', 'Abrir Ajustes', 'Permite el acceso a la cámara para Sermable en Ajustes y vuelve a intentarlo.', 'Permite la cámara en los ajustes del sitio del navegador y vuelve a intentarlo.', 'Reintentar'],
  it: ['Consenti la fotocamera', 'La fotocamera serve a fotografare il copione e aggiungerne il testo al discorso.', 'Apri Impostazioni', 'Consenti a Sermable di usare la fotocamera nelle Impostazioni e riprova.', 'Consenti la fotocamera nelle impostazioni del sito del browser e riprova.', 'Riprova'],
  pt: ['Permitir a câmera', 'A câmera permite fotografar o roteiro e adicionar o texto ao discurso.', 'Abrir Configurações', 'Permita a câmera para o Sermable nas Configurações e tente novamente.', 'Permita a câmera nas configurações do site do navegador e tente novamente.', 'Tentar novamente'],
} as const;

export default function CameraPermissionNotice({onRetry}: {onRetry: () => void}) {
  const {i18n} = useTranslation();
  const language = i18n.language.split(/[-_]/)[0];
  const labels = copy[language as keyof typeof copy] ?? copy.en;
  const [settingsFailed, setSettingsFailed] = useState(false);
  const native = Capacitor.isNativePlatform();
  return <section className="camera-permission" role="alert">
    <Camera aria-hidden="true"/><h3>{labels[0]}</h3><p>{labels[1]}</p>
    <p>{native ? labels[3] : labels[4]}</p>
    <div className="camera-permission__actions">
      {native && <Button type="button" onClick={() => {
        void NativeSettings.open({optionIOS: IOSSettings.App, optionAndroid: AndroidSettings.ApplicationDetails})
          .catch(() => setSettingsFailed(true));
      }}><Settings aria-hidden="true"/>{labels[2]}</Button>}
      <Button type="button" variant="outline" onClick={onRetry}>{labels[5]}</Button>
    </div>
    {settingsFailed && <p>{labels[3]}</p>}
  </section>;
}