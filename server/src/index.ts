import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { initializeDatabase } from './db/schema';
import { errorHandler, notFound } from './middleware/errorHandler';
import projectsRouter from './routes/projects';
import stagesRouter from './routes/stages';
import tasksRouter from './routes/tasks';
import risksRouter from './routes/risks';
import documentsRouter from './routes/documents';
import dashboardRouter from './routes/dashboard';
import chatRouter from './routes/chat';
import attachmentsRouter from './routes/attachments';
import factoriesRouter from './routes/factories';
import engagementsRouter from './routes/engagements';
import rfqRouter from './routes/rfq';
import samplesRouter from './routes/samples';
import packagingRouter from './routes/packaging';
import communicationsRouter from './routes/communications';
import negotiationsRouter from './routes/negotiations';
import productionRouter from './routes/production';
import documentationRouter from './routes/documentation';
import shippingRouter from './routes/shipping';
import templatesRouter from './routes/templates';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import notificationsRouter from './routes/notifications';
import workspaceRouter from './routes/workspace';

// Khởi tạo database khi server start
initializeDatabase();

const app = express();
const PORT = process.env.PORT ?? 3001;

// -------------------------
// Middleware
// -------------------------
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'] }));
app.use(express.json());
app.use(morgan('dev'));

// -------------------------
// Routes
// -------------------------
app.use('/api', authRouter);
app.use('/api', usersRouter);
app.use('/api', dashboardRouter);
app.use('/api/projects', projectsRouter);

app.use('/api', stagesRouter);
app.use('/api', tasksRouter);
app.use('/api', risksRouter);
app.use('/api', documentsRouter);
app.use('/api', chatRouter);
app.use('/api', attachmentsRouter);
app.use('/api', factoriesRouter);
app.use('/api', engagementsRouter);
app.use('/api', rfqRouter);
app.use('/api', samplesRouter);
app.use('/api', packagingRouter);
app.use('/api', communicationsRouter);
app.use('/api', negotiationsRouter);
app.use('/api', productionRouter);
app.use('/api', documentationRouter);
app.use('/api', shippingRouter);
app.use('/api', templatesRouter);
app.use('/api', notificationsRouter);
app.use('/api', workspaceRouter);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404 và Error handler
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});

export default app;
