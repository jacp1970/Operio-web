import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { JobsView } from './components/JobsView';
import { DepartmentsView } from './components/DepartmentsView';
import { StatusesView } from './components/StatusesView';
import { UsersView } from './components/UsersView';
import { NotificationsView } from './components/NotificationsView';
import { LoginView } from './components/LoginView';
import { JobModal } from './components/JobModal';
import { PdfViewerModal } from './components/PdfViewerModal';
import { WorkOrder } from './types';

function MainApp() {
  const { currentUser, currentNav, setCurrentNav, workOrders } = useApp();

  // Mobile drawer state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Job Modal state
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<WorkOrder | null>(null);

  // PDF Preview modal state
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [activePdfAttachment, setActivePdfAttachment] = useState<{
    name: string;
    dataUrl: string;
  } | null>(null);

  // If not logged in, render the Login / Register screen
  if (!currentUser) {
    return <LoginView />;
  }

  // Open Job Details / Edit modal
  const handleOpenJobDetail = (job: WorkOrder) => {
    setSelectedJob(job);
    setJobModalOpen(true);
  };

  // Open New Job modal
  const handleOpenNewJobModal = () => {
    setSelectedJob(null);
    setJobModalOpen(true);
  };

  // Open PDF viewer
  const handleOpenPdfViewer = (attachment: { name: string; dataUrl: string }) => {
    setActivePdfAttachment(attachment);
    setPdfViewerOpen(true);
  };

  // Open job from notification OT
  const handleOpenJobByOt = (ot: string) => {
    const found = workOrders.find((w) => w.ot.toLowerCase() === ot.toLowerCase());
    if (found) {
      handleOpenJobDetail(found);
    } else {
      setCurrentNav('trabajos');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col lg:flex-row antialiased selection:bg-indigo-100 selection:text-indigo-900">
      {/* Lateral Menu / Sidebar (strictly follows PDF ordering and role permissions) */}
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header with persistent logo, role switcher, and quick action */}
        <Header
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onOpenNewJobModal={handleOpenNewJobModal}
        />

        {/* Dynamic Workspace Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentNav === 'panel_de_control' && (
            <DashboardView
              onOpenJobDetail={handleOpenJobDetail}
              onOpenNewJobModal={handleOpenNewJobModal}
            />
          )}

          {currentNav === 'trabajos' && (
            <JobsView
              onOpenJobDetail={handleOpenJobDetail}
              onOpenNewJobModal={handleOpenNewJobModal}
              onOpenPdfViewer={handleOpenPdfViewer}
            />
          )}

          {currentNav === 'departamentos' && <DepartmentsView />}

          {currentNav === 'estados' && <StatusesView />}

          {currentNav === 'usuarios' && <UsersView />}

          {currentNav === 'notificaciones' && (
            <NotificationsView onOpenJobByOt={handleOpenJobByOt} />
          )}
        </main>
      </div>

      {/* Modal: Job Create / Edit / View */}
      <JobModal
        job={selectedJob}
        isOpen={jobModalOpen}
        onClose={() => setJobModalOpen(false)}
        onOpenPdfViewer={handleOpenPdfViewer}
      />

      {/* Modal: PDF Viewer / Downloader */}
      <PdfViewerModal
        attachment={activePdfAttachment}
        isOpen={pdfViewerOpen}
        onClose={() => setPdfViewerOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
