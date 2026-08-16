import { createServer } from "http";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    });
  })
    .once("error", (err: Error) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      // eslint-disable-next-line no-console
      console.log(`> Server ready at http://${hostname}:${port}`);
    });
});
