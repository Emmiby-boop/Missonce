export const useToast = () => {
  const success = (message: string) => {
    alert(message);
  };

  const error = (message: string) => {
    alert(message);
  };

  const warning = (message: string) => {
    alert(message);
  };

  const info = (message: string) => {
    alert(message);
  };

  const confirm = async (message: string, title = '确认操作') => {
    return window.confirm(message);
  };

  return { success, error, warning, info, confirm };
};
