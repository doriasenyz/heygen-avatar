import {
  AvatarQuality,
  StreamingEvents,
  VoiceChatTransport,
  VoiceEmotion,
  StartAvatarRequest,
  STTProvider,
  ElevenLabsModel,
  TaskType,
  TaskMode,
} from "@heygen/streaming-avatar";
import { useEffect, useRef, useState } from "react";
import { useMemoizedFn, useUnmount } from "ahooks";

import { Button } from "./Button";
import RecordButton from "@/components/RecordButton";
import { AvatarVideo } from "./AvatarSession/AvatarVideo";
import { useStreamingAvatarSession } from "./logic/useStreamingAvatarSession";
import { useVoiceChat } from "./logic/useVoiceChat";
import { StreamingAvatarProvider, StreamingAvatarSessionState } from "./logic";
import { useStreamingAvatarContext } from "./logic/context";
import { LoadingIcon } from "./Icons"; 

const DEFAULT_CONFIG: StartAvatarRequest = {
  quality: AvatarQuality.High,
  avatarName: "d888f58da09648bfb520315b93971945",
  knowledgeId: undefined,
  voice: {
    voiceId: "fb3dcd1398534927a2308c3d7ee10c5b",
    rate: 1,
    emotion: VoiceEmotion.EXCITED,
    model: ElevenLabsModel.eleven_flash_v2_5,
  },
  language: "he",
  voiceChatTransport: VoiceChatTransport.WEBSOCKET,
  sttSettings: {
    provider: STTProvider.GLADIA,
  },
};

function InteractiveAvatar() {
  const { initAvatar, startAvatar, stopAvatar, sessionState, stream } =
    useStreamingAvatarSession();
  const { startVoiceChat } = useVoiceChat();
  const { avatarRef } = useStreamingAvatarContext();

  const [config, setConfig] = useState<StartAvatarRequest>(DEFAULT_CONFIG);
  const [isAds, setIsAds] = useState(false);
  const mediaStream = useRef<HTMLVideoElement>(null);
  const [language, setLanguage] = useState("he-IL");
  const [userInput, setUserInput] = useState("");
  const [images, setImages] = useState<Array<{ image1: string; images: string[]; video: string; title: string; description: string }>>([]);
  const [selectedItem, setSelectedItem] = useState<{ image1: string; images: string[]; video: string; title: string; description: string } | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imagesContainerRef = useRef<HTMLDivElement>(null);
  const [imageWidth, setImageWidth] = useState(256); 
  
  // Logo path with Hebrew characters - use encodeURI to handle Unicode properly
  const logoPath = "/%D7%9C%D7%95%D7%92%D7%95%20%D7%A9%D7%97%D7%95%D7%A8.png";


  const fetchEphemeralKey = async (): Promise<string | null> => {
    console.log("fetch_session_token_request");
    const tokenResponse = await fetch("/api/session");
    const data = await tokenResponse.json();
    console.log("fetch_session_token_response");

    if (!data.client_secret?.value) {
      console.log("error.no_ephemeral_key");
      console.log("No ephemeral key provided by the server");
      // setSessionStatus("DISCONNECTED");
      return null;
    }

    return data.client_secret.value;
  };

  // Initialize and connect Realtime Session
  
  const appendTranscript = useMemoizedFn(async (text: string) => {
    if (
      sessionState === StreamingAvatarSessionState.CONNECTED &&
      avatarRef.current
    ) {
      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });

        const response = await res.json();
        // Send response to avatar
        console.log("response:", response);
        avatarRef.current.speak({
          text: response.answer,
          task_type: TaskType.REPEAT,
          taskMode: TaskMode.SYNC,
        });
        if(response.iscompleted){
         try {
              const category = encodeURIComponent(response.category);
              const subcategory = encodeURIComponent(response.subcategory);
              const res = await fetch(`/api/excel?category=${category}&subcategory=${subcategory}`);
              const data = await res.json();
              console.log(data);
              if (data.items) {
                setImages(data.items);
                setSelectedItem(null);
                setShowGallery(false);
                setShowInfo(false);
                setCurrentImageIndex(0);
              }
            } catch (error) {
              console.error("Error fetching images:", error);
            }
        }
      } catch (error) {
        console.error("Error sending message to avatar:", error);
      }
    }
  });

  async function fetchAccessToken() {
    try {
      const response = await fetch("/api/get-access-token", {
        method: "POST",
      });
      const token = await response.text();

      console.log("Access Token:", token); // Log the token to verify

      return token;
    } catch (error) {
      console.error("Error fetching access token:", error);
      throw error;
    }
  }

  const startSessionV2 = useMemoizedFn(async (isVoiceChat: boolean) => {
    try {
      setIsAds(false);
      const newToken = await fetchAccessToken();
      const avatar = initAvatar(newToken);

      await startAvatar(config);
      if (isVoiceChat) {
        await startVoiceChat(true);
      }
    } catch (error) {
      console.error("Error starting avatar session:", error);
    }
  });
  useUnmount(() => {
    stopAvatar();
    // Clean up realtime session
    
  });

  useEffect(() => {
    if (stream && mediaStream.current) {
      mediaStream.current.srcObject = stream;
      mediaStream.current.onloadedmetadata = () => {
        mediaStream.current!.play();
      };
    }
  }, [mediaStream, stream]);

  // Auto-replay video when it ends
  useEffect(() => {
    if (videoRef.current && selectedItem?.video) {
      const video = videoRef.current;
      const handleEnded = () => {
        video.currentTime = 0;
        video.play();
      };
      video.addEventListener("ended", handleEnded);
      return () => {
        video.removeEventListener("ended", handleEnded);
      };
    }
  }, [selectedItem]);

  // Calculate image width based on container size and number of images
  useEffect(() => {
    if (imagesContainerRef.current && images.length > 0) {
      const calculateWidth = () => {
        const container = imagesContainerRef.current;
        if (!container) return;
        
        const gapSize = 16; // gap-4 = 1rem = 16px
        const padding = 32; // px-4 = 1rem on each side = 32px total
        const containerWidth = container.offsetWidth || window.innerWidth;
        const availableWidth = containerWidth - padding;
        const totalGaps = (images.length - 1) * gapSize;
        const calculatedWidth = Math.min(256, (availableWidth - totalGaps) / images.length);
        setImageWidth(calculatedWidth);
      };

      calculateWidth();
      window.addEventListener('resize', calculateWidth);
      return () => window.removeEventListener('resize', calculateWidth);
    }
  }, [images.length]);

  return (
    <div className="w-full h-full">
      {/* Logo - Top Left */}
      <div className="fixed top-4 left-8 z-50">
        <img 
          src={logoPath} 
          alt="Logo" 
          className="h-32 w-auto"
        />
      </div>
      <div className="relative w-full h-full">
      <div className="fixed bottom-8 right-8 bg-white p-4 rounded-xl shadow-xl z-50 w-80">
        <input
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Type your message..."
          className="border p-2 w-full rounded-md text-black"
        />

        <button
          onClick={async () => {
            if (!userInput.trim()) return;
            appendTranscript(userInput);
            setUserInput(""); // Clear input
          }}
          //   try {
          //     const category = encodeURIComponent("מדיח כלים");
          //     const subcategory = encodeURIComponent("מדיח אינטגרלי");
          //     const res = await fetch(`/api/excel?category=${category}&subcategory=${subcategory}`);
          //     const data = await res.json();
          //     console.log(data);
          //     if (data.items) {
          //       setImages(data.items);
          //       setSelectedItem(null);
          //       setShowGallery(false);
          //       setShowInfo(false);
          //       setCurrentImageIndex(0);
          //     }
          //   } catch (error) {
          //     console.error("Error fetching images:", error);
          //   }
          // }}
          className="bg-blue-600 text-white px-4 py-2 mt-2 rounded-md w-full"
        >
          Fetch Images
        </button>
        </div>
        {sessionState !== StreamingAvatarSessionState.INACTIVE && (
          <AvatarVideo ref={mediaStream} isAds={isAds} />
        )}

        {sessionState === StreamingAvatarSessionState.CONNECTED && (
          <div className="fixed right-6 bottom-24 z-[60] flex flex-col gap-3 items-center">
            <RecordButton
              onTranscript={appendTranscript}
              className="shadow-xl"
            />
          </div>
        )}

        {sessionState === StreamingAvatarSessionState.INACTIVE && images.length === 0 && !selectedItem && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-row gap-4 z-30">
            <Button onClick={() => startSessionV2(true)}>Start</Button>
          </div>
        )}

        {sessionState === StreamingAvatarSessionState.CONNECTING && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-30">
            <LoadingIcon className="text-black" size={48} />
          </div>
        )}
      </div>
      {sessionState === StreamingAvatarSessionState.CONNECTED && <></>}

      {/* Dialog with transparent background */}
      {images.length > 0 && (
        <div 
          className="fixed inset-0  z-40 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget && !selectedItem && !showGallery && !showInfo) {
              setImages([]);
              setSelectedItem(null);
              setShowGallery(false);
              setShowInfo(false);
            }
          }}
        >
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {/* Close button - Top right */}
            <button
              onClick={async () => {
                // If showing gallery or info, go back to video view
                if (showGallery || showInfo) {
                  setShowGallery(false);
                  setShowInfo(false);
                  setCurrentImageIndex(0);
                }
                // If showing video (selectedItem), go back to images grid
                else if (selectedItem) {
                  setSelectedItem(null);
                  setShowGallery(false);
                  setShowInfo(false);
                  setCurrentImageIndex(0);
                  // Resume avatar session if it was stopped
                  if (sessionState === StreamingAvatarSessionState.INACTIVE) {
                    await startSessionV2(true);
                  }
                }
                // If showing images grid, close everything and start avatar session
                else {
                  setImages([]);
                  setSelectedItem(null);
                  setShowGallery(false);
                  setShowInfo(false);
                  setCurrentImageIndex(0);
                  // Start avatar session if it's not active
                  if (sessionState === StreamingAvatarSessionState.INACTIVE) {
                    await startSessionV2(true);
                  }
                }
              }}
              className="absolute top-4 right-4 z-50 hover:opacity-80 transition-opacity"
            >
              <img src="/close.png" alt="Close" className="w-[60px] h-[60px]" />
            </button>

            {/* Gallery and Info buttons - Center right (always visible when item is selected) */}
            {selectedItem && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-50">
                <button
                  onClick={() => {
                    setShowGallery(true);
                    setShowInfo(false);
                    setCurrentImageIndex(0);
                  }}
                  className={`hover:opacity-80 transition-opacity ${showGallery ? 'opacity-100  rounded-lg' : 'opacity-70'}`}
                >
                  <img src="/gallery.png" alt="Gallery" className="w-[60px] h-[60px]" />
                </button>
                <button
                  onClick={() => {
                    setShowInfo(true);
                    setShowGallery(false);
                  }}
                  className={`hover:opacity-80 transition-opacity ${showInfo ? 'opacity-100  rounded-lg' : 'opacity-70'}`}
                >
                  <img src="/INFO.png" alt="Info" className="w-[60px] h-[60px]" />
                </button>
              </div>
            )}

            {/* Gallery Slider */}
            {showGallery && selectedItem && (
              <div className="w-full h-full flex items-center justify-center relative">
                {selectedItem.images.length > 1 && (
                  <>
                    <button
                      onClick={() => {
                        setCurrentImageIndex((prev) => 
                          prev > 0 ? prev - 1 : selectedItem.images.length - 1
                        );
                      }}
                      className="absolute left-20 top-1/2 -translate-y-1/2 bg-black bg-opacity-60 hover:bg-opacity-80 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 z-40"
                      aria-label="Previous image"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        setCurrentImageIndex((prev) => 
                          prev < selectedItem.images.length - 1 ? prev + 1 : 0
                        );
                      }}
                      className="absolute right-20 top-1/2 -translate-y-1/2 bg-black bg-opacity-60 hover:bg-opacity-80 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 z-40"
                      aria-label="Next image"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                )}
                <img
                  src={selectedItem.images[currentImageIndex]}
                  alt={`Gallery ${currentImageIndex + 1}`}
                  className="max-w-full max-h-[90vh] object-contain rounded-lg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://via.placeholder.com/800x600?text=No+Image";
                  }}
                />
              </div>
            )}

            {/* Info/Description Panel */}
            {showInfo && selectedItem && (
              <div className="w-full h-full flex items-center justify-center p-8">
                <div className="bg-black rounded-2xl shadow-2xl p-8 max-w-4xl max-h-[85vh] overflow-auto relative">
                  <div className="mb-6 pb-6 border-b-2 border-gray-200 ">
                    <h2 className="text-3xl font-bold text-white-900 mb-2">
                      {selectedItem.title || "Product Information"}
                    </h2>
                    
                  </div>
                  
                  <div className="prose prose-lg max-w-none ">
                    <div 
                      className="text-gray-700 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: selectedItem.description || "No description available." }}
                    />
                  </div>
                   
                </div>
              </div>
            )}

            {/* Video Player */}
            {selectedItem?.video && !showGallery && !showInfo && (
              <div className="relative w-full h-full flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={selectedItem.video}
                  autoPlay
                  loop={false}
                  className="w-full h-full object-contain bg-transparent"
                  style={{ backgroundColor: 'transparent' }}
                  playsInline
                  onError={(e) => {
                    console.error("Video error:", e);
                  }}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            )}

            {/* Images Grid */}
            {!selectedItem && !showGallery && !showInfo && (
              <div className="w-full h-full flex items-center justify-center px-4 py-8">
                <div 
                  ref={imagesContainerRef}
                  className="flex flex-row gap-4 overflow-hidden justify-center items-center w-full hide-scrollbar"
                >
                  {images.map((item, index) => (
                    <div
                      key={index}
                      onClick={async () => {
                        if (item.video) {
                          // Stop avatar session if it's playing
                          if (sessionState === StreamingAvatarSessionState.CONNECTED) {
                            await stopAvatar();
                          }
                          setSelectedItem(item);
                          setShowGallery(false);
                          setShowInfo(false);
                          setCurrentImageIndex(0);
                        }
                      }}
                      className="cursor-pointer bg-white rounded-xl overflow-hidden hover:shadow-2xl transition-all hover:scale-105 flex-shrink-0 border border-gray-200"
                      style={{ width: `${imageWidth}px` }}
                    >
                      <div className="w-full aspect-square overflow-hidden bg-gray-50 rounded-t-xl border-b border-gray-200">
                        <img
                          src={item.image1}
                          alt={item.title || `Product ${index + 1}`}
                          className="w-full h-full object-contain p-2"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://via.placeholder.com/300x200?text=No+Image";
                          }}
                        />
                      </div>
                      <div className="p-3 bg-white rounded-b-xl">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {item.title || "Untitled"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function InteractiveAvatarWrapper() {
  return (
    <StreamingAvatarProvider basePath={process.env.NEXT_PUBLIC_BASE_API_URL}>
      <InteractiveAvatar />
    </StreamingAvatarProvider>
  );
}
