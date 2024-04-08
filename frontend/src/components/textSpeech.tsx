import { useState, useEffect } from "react";
import SettingsApplicationsIcon from "@mui/icons-material/SettingsApplications";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import PauseIcon from "@mui/icons-material/Pause";

const TextToSpeech = ({ text }: { text: string | undefined }) => {
  const [isPaused, setIsPaused] = useState(true);
  const [utterance, setUtterance] = useState<
    SpeechSynthesisUtterance | null | undefined
  >(null);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  /*   const [pitch, setPitch] = useState(1);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(1); */
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [settings, setSettings] = useState(true);

  useEffect(() => {
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);

    //console.log(voices, "voices before");

    if (voices.length === 0) {
      console.log("voices", voices);
      setVoices(synth.getVoices());
      //Set the voice to the first voice
      const theVoice = voices.find(
        (v) => v.name === "Microsoft Zira - English (United States)"
      );
      // console.log(voices);
      console.log(theVoice);
      if (theVoice) setVoice(theVoice);
    }

    //console.log(voices, "voices after");

    setUtterance(u);

    // Add an event listener to the speechSynthesis object to listen for the voiceschanged event
    synth.addEventListener("voiceschanged", () => {
      console.log(voices, "voices");
      console.log(voices[0]);

      if (voices.length > 0) setVoice(voices[112]);
    });

    if (text && voices.length > 0 && u) {
      u.voice = voice;
      /*   u.pitch = pitch;
      u.rate = rate;
      u.volume = volume; */
      synth.speak(u);
      u.onend = function () {
        setIsPaused(true);
      };
    }

    return () => {
      synth.cancel();
      synth.removeEventListener("voiceschanged", () => {
        setVoice(null);
      });
    };
  }, [text, voice, /* pitch, rate, volume, */ voices]);

  const handlePlay = () => {
    const synth = window.speechSynthesis;
    console.log(isPaused, "isPaused");

    if (isPaused && utterance?.text) {
      utterance.voice = voice;
      /*  utterance.pitch = pitch;
      utterance.rate = rate;
      utterance.volume = volume; */
      console.log(utterance, "utterance");
      synth.speak(utterance);
      utterance.onend = function () {
        setIsPaused(true);
      };

      setIsPaused(false);
    }
  };

  /* const handleStop = () => {
    const synth = window.speechSynthesis;
    setIsPaused(false);
    synth.cancel();
  };
*/
  const handlePause = () => {
    const synth = window.speechSynthesis;
    setIsPaused(true);
    synth.pause();
  };

  const handleVoiceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const theVoice = voices.find((v) => v.name === event.target.value);
    // console.log(voices);
    console.log(theVoice);
    if (theVoice) {
      setSettings(true);
      setVoice(theVoice);
    }
  };

  /* const handlePitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPitch(parseFloat(event.target.value));
  };

  const handleRateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRate(parseFloat(event.target.value));
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(event.target.value));
  };
 */
  const settingsFunc = () => {
    setSettings(!settings);
  };

  return (
    <div style={{ display: "flex" }}>
      <label>
        {settings ? (
          <div onClick={settingsFunc}>
            <SettingsApplicationsIcon />
          </div>
        ) : (
          <select value={voice?.name || ""} onChange={handleVoiceChange}>
            {voices.map((voice: SpeechSynthesisVoice) => (
              <option key={voice.name} value={voice.name}>
                {voice.name}
              </option>
            ))}
          </select>
        )}
      </label>
      {/*  <br />
       <label>
        Pitch:
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={pitch}
          onChange={handlePitchChange}
        />
      </label>
      <br />
      <label>
        Speed:
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={rate}
          onChange={handleRateChange}
        />
      </label>
      <br />
      <label>
        Volume:
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={handleVolumeChange}
        />
      </label> 
      <br />*/}
      {isPaused ? (
        <div onClick={handlePlay}>
          <VolumeUpIcon />
        </div>
      ) : (
        <div onClick={handlePause}>
          <PauseIcon />
        </div>
      )}
      {/* <button onClick={handlePlay}>{isPaused ? "Resume" : "Play"}</button>
      <button onClick={handlePause}>Pause</button>
      <button onClick={handleStop}>Stop</button> */}
    </div>
  );
};

export default TextToSpeech;
