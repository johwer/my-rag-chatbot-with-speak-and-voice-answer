import { useEffect, useState } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";

type DictaphoneProps = {
  input: string;
  handleSend: () => Promise<void>;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  inputType: string;
  setInputType: React.Dispatch<React.SetStateAction<string>>;
};

const Dictaphone = ({
  setInput,
  handleSend,
  input,
  inputType,
  setInputType,
}: DictaphoneProps) => {
  const {
    transcript,
    listening,
    //resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    if (listening && !isListening) {
      setIsListening(true);
      setInputType("speech");
    }
    if (!listening && isListening) {
      setIsListening(false);
      setInput(transcript);
    }
    if (inputType === "speech") {
      handleSend();
    }
  }, [
    listening,
    isListening,
    transcript,
    setInput,
    handleSend,
    input,
    inputType,
    setInputType,
  ]);

  if (!browserSupportsSpeechRecognition) {
    return <span>Browser doesn't support speech recognition.</span>;
  }

  return (
    <>
      {/* <p>Microphone: {listening ? "on" : "off"}</p> */}

      <div
        onClick={(event: React.MouseEvent<HTMLDivElement>) => {
          event.preventDefault();
          if (listening) {
            SpeechRecognition.stopListening();
          } else SpeechRecognition.startListening();
        }}
      >
        {listening ? <MicOffIcon /> : <MicIcon />}
      </div>
      {/*  <button onClick={resetTranscript}>Reset</button>
      <p>{transcript}</p> */}
    </>
  );
};

export default Dictaphone;
