import {
  runServerlessWorkOrderExtraction,
  type ServerlessReq,
  type ServerlessRes,
} from './_geminiWorkOrder';

export default async function handler(req: ServerlessReq, res: ServerlessRes) {
  return runServerlessWorkOrderExtraction(req, res, 'pdf');
}
