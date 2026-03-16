interface SkeletonProps {
  height?: number
}

export const Skeleton = ({ height = 14 }: SkeletonProps) => {
  return <div className="skeleton" style={{ height }} />
}
