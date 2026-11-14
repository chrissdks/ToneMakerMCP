import {
  AppBridge,
  PostMessageTransport,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import html from "../../dist/ui/index.html?raw";
const iframe = document.getElementById("view") as HTMLIFrameElement;
const bridge = new AppBridge(
  null,
  { name: "Local browser acceptance harness", version: "1" },
  { serverTools: {}, openLinks: {} },
);
bridge.oncalltool = async (params) => (window as any).mcpCall(params);
bridge.onopenlink = async () => ({});
bridge.oninitialized = () => {
  void bridge.sendToolResult({
    structuredContent: { query: "clean" },
    content: [{ type: "text", text: "Local harness" }],
  });
};
await bridge.connect(
  new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!),
);
iframe.srcdoc = html;
