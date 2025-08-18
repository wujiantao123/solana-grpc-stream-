import axios from "axios";
const sendMessage = async (msg: string) => {
  const postMessage = async () => {
    await axios.post(
      "https://oapi.dingtalk.com/robot/send?access_token=fa880f50eac31be9ab61f19b01a7644a9f16f19bb454055c4f5b9ddb643e9d89",
      {
        msgtype: "text",
        text: {
          content: `ca: ${msg} \n${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
        },
        at: {
          isAtAll: true,
        },
      }
    );
  };

  try {
    await postMessage();
  } catch (error) {
    console.error(error);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    try {
      await postMessage();
    } catch (retryError) {
      console.error(retryError);
    }
  }
};
export default sendMessage;
