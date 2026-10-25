// Preload before the application imports http/fetch. No Azure export without a connection string.
if(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING){
 await import('@microsoft/opentelemetry/loader');
 const {useMicrosoftOpenTelemetry}=await import('@microsoft/opentelemetry');
 // Automatic HTTP/AI instrumentation can capture URLs or prompt content. Export only
 // the deliberately limited recovery spans defined in recovery-trace.mjs.
 const disabled={enabled:false};
 useMicrosoftOpenTelemetry({
  instrumentationOptions:{http:disabled,azureSdk:disabled,mongoDb:disabled,mySql:disabled,postgreSql:disabled,redis:disabled,redis4:disabled,openaiAgents:disabled,langchain:disabled,console:disabled,bunyan:disabled,winston:disabled},
  azureMonitor:{azureMonitorExporterOptions:{connectionString:process.env.APPLICATIONINSIGHTS_CONNECTION_STRING}}
 });
}
