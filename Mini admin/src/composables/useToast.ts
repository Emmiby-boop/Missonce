import { ElMessage, ElMessageBox } from 'element-plus';

export const useToast = () => {
  const success = (message: string) => {
    ElMessage.success({
      message,
      duration: 2000
    });
  };

  const error = (message: string) => {
    ElMessage.error({
      message,
      duration: 3000
    });
  };

  const warning = (message: string) => {
    ElMessage.warning({
      message,
      duration: 2500
    });
  };

  const info = (message: string) => {
    ElMessage.info({
      message,
      duration: 2000
    });
  };

  const confirm = async (message: string, title = '确认操作') => {
    try {
      await ElMessageBox.confirm(message, title, {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      });
      return true;
    } catch {
      return false;
    }
  };

  return { success, error, warning, info, confirm };
};
