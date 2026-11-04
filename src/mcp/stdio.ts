import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { LOCAL_PRINCIPAL } from "./auth";
import { createStoreServer } from "./server";
import { simulatedVtex } from "./simulated-vtex";

// Stdout belongs to the protocol: anything else printed there breaks the client.
serveStdio(() => createStoreServer(simulatedVtex, LOCAL_PRINCIPAL));
