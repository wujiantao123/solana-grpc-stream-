import axios from "axios";
const sendMessage = async (msg: string) => {
  const postMessage = async () => {
    const req = {
      msg_type: "text",
      content: JSON.stringify({
        text: `ca: ${msg} \n${new Date().toLocaleString("zh-CN", {
          timeZone: "Asia/Shanghai",
        })}`,
      }),
    };
    await axios.post(
      "https://open.feishu.cn/open-apis/bot/v2/hook/48efcce6-6b52-456f-859b-891446fb2995",
      req
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