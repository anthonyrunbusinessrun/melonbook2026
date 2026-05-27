import Image from 'next/image';

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className = '', priority }: BrandLogoProps) {
  return (
    <span className={`brand-logo-wrap inline-flex items-center ${className}`}>
      <Image
        src="/brand/melonbook-logo-dark.svg"
        alt="MelonBook"
        width={1617}
        height={447}
        className="brand-logo-dark h-full w-full object-contain"
        priority={priority}
        unoptimized
      />
      <Image
        src="/brand/melonbook-logo-light.svg"
        alt="MelonBook"
        width={1596}
        height={447}
        className="brand-logo-light h-full w-full object-contain"
        priority={priority}
        unoptimized
      />
    </span>
  );
}
