'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from './ui/button';
import { Modal } from './ui/modal';
import { Select } from './ui/select';
import { uploadReceipt, UploadProgress } from '@/services/receipt-upload';
import { Plus, X, FileText, Image as ImageIcon, Loader2, Link as LinkIcon } from 'lucide-react';
import { useToast } from './ui/toast';
import { useQuery } from '@tanstack/react-query';
import { usePrivy } from '@privy-io/react-auth';

interface MediaUploadProps {
  groupId: string;
  onSuccess?: () => void;
}

interface FileWithProgress {
  file: File;
  progress: UploadProgress;
  expenseId?: string;
}

export function MediaUpload({ groupId, onSuccess }: MediaUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<FileWithProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { notify } = useToast();
  const { getAccessToken } = usePrivy();

  const { data: expensesRes } = useQuery({
    queryKey: ['expenses', groupId],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`/api/groups/${groupId}/expenses`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch expenses');
      const payload = await res.json();
      return payload.data;
    },
    enabled: isOpen,
  });

  const expenses = expensesRes?.items || [];

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      progress: { status: 'idle' as const, progress: 0 },
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.heic'],
      'application/pdf': ['.pdf'],
    },
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const updateFileExpense = (index: number, expenseId: string) => {
    setFiles(prev => prev.map((f, i) => i === index ? { ...f, expenseId: expenseId === 'none' ? undefined : expenseId } : f));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setIsUploading(true);

    const uploadPromises = files.map(async (fileData, index) => {
      try {
        const token = await getAccessToken();
        const cid = await uploadReceipt(
          fileData.file,
          (p) => {
            setFiles(prev => prev.map((f, i) => i === index ? { ...f, progress: p } : f));
          },
          getAccessToken
        );

        const res = await fetch(`/api/groups/${groupId}/media`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            cid,
            media_type: fileData.file.type,
            title: fileData.file.name,
            expense_id: fileData.expenseId,
          }),
        });

        if (!res.ok) throw new Error('Failed to save media record');

        return true;
      } catch (err) {
        console.error('Upload failed for file:', fileData.file.name, err);
        return false;
      }
    });

    const results = await Promise.all(uploadPromises);
    const successCount = results.filter(Boolean).length;

    if (successCount === files.length) {
      notify({
        title: 'Success',
        description: `Successfully uploaded ${successCount} file(s)`,
        variant: 'success',
      });
      setFiles([]);
      setIsOpen(false);
      onSuccess?.();
    } else {
      notify({
        title: 'Error',
        description: `Failed to upload ${files.length - successCount} file(s)`,
        variant: 'error',
      });
    }

    setIsUploading(false);
  };

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-2xl bg-primary text-primary-foreground sm:static sm:h-auto sm:w-auto sm:rounded-xl sm:px-4 sm:py-2 sm:shadow-none"
      >
        <Plus className="h-6 w-6 sm:mr-2 sm:h-4 sm:w-4" />
        <span className="hidden sm:inline">Upload Media</span>
      </Button>

      <Modal
        open={isOpen}
        onOpenChange={(open) => !isUploading && setIsOpen(open)}
        title="Upload Photos & Documents"
      >
        <div className="space-y-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 rounded-full bg-primary/10 text-primary">
                <Plus className="h-6 w-6" />
              </div>
              <p className="font-bold">Drop files here or click to upload</p>
              <p className="text-sm text-muted-foreground">JPEG, PNG, HEIC, or PDF (max 10MB)</p>
            </div>
          </div>

          {files.length > 0 && (
            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
              {files.map((f, i) => (
                <div key={i} className="flex flex-col gap-2 p-3 rounded-xl border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {f.file.type.startsWith('image/') ? (
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{f.file.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {(f.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    {!isUploading && (
                      <button 
                        onClick={() => removeFile(i)}
                        className="p-1 hover:bg-muted rounded-full text-muted-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {f.progress.status !== 'idle' && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                        <span>{f.progress.status}</span>
                        <span>{f.progress.progress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-300" 
                          style={{ width: `${f.progress.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {!isUploading && (
                    <div className="flex items-center gap-2 mt-1">
                      <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <Select
                        value={f.expenseId || 'none'}
                        onValueChange={(val: string) => updateFileExpense(i, val)}
                        options={[
                          { label: 'No Expense Linked', value: 'none' },
                          ...expenses.map((e: any) => ({
                            label: `${e.description} (${e.currency} ${e.total_amount})`,
                            value: e.id
                          }))
                        ]}
                        className="text-xs h-8"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setIsOpen(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={files.length === 0 || isUploading}
              onClick={handleUpload}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                `Upload ${files.length} File${files.length === 1 ? '' : 's'}`
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
